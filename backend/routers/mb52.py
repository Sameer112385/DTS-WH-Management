from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
import os
import shutil
from typing import List
from backend.database import get_db
from backend.models import (
    MB52UploadHistory, Discrepancy, Stock, Material, 
    Plant, StorageLocation, WbsElement, AuditTrail, User
)
from backend.schemas import MB52UploadHistoryResponse, DiscrepancyResponse
from backend.config import settings
from backend.auth import get_current_user, RoleChecker
from backend.utils.excel_parser import parse_mb52_excel
from backend.utils.email_sender import send_email_notification

router = APIRouter(prefix="/mb52", tags=["mb52"])

@router.post("/upload", response_model=MB52UploadHistoryResponse)
def upload_mb52(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager", "Warehouse Supervisor"]))
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed.")

    # Save uploaded file
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Parse file
    success, msg, records = parse_mb52_excel(file_path)
    if not success:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=msg)

    # Initialize upload history record
    upload_history = MB52UploadHistory(
        filename=file.filename,
        uploaded_by=current_user.username,
        status="Pending",
        total_records=len(records),
        discrepancies_found=0
    )
    db.add(upload_history)
    db.commit()
    db.refresh(upload_history)

    discrepancy_count = 0
    
    # We will build a key-map of the uploaded records
    # key: (material_code, plant, storage_location, wbs)
    upload_map = {}
    for r in records:
        # Skip ignored material groups
        mat_group = (r.get("material_group") or "").strip().upper()
        if mat_group in ("ZDS062", "ZDS074"):
            continue

        # Create Material if not exists
        mat = db.query(Material).filter(Material.material_code == r["material_code"]).first()
        if not mat:
            mat = Material(
                material_code=r["material_code"],
                description=r["description"],
                uom=r["uom"],
                material_type=r["material_type"],
                material_group=r["material_group"]
            )
            db.add(mat)
            db.commit()
            db.refresh(mat)

        # Create Plant if not exists
        pl = db.query(Plant).filter(Plant.code == r["plant"]).first()
        if not pl:
            pl = Plant(code=r["plant"], name=f"Plant {r['plant']}", location="Imported via MB52")
            db.add(pl)
            db.commit()

        # Create Storage Location if not exists
        sl = db.query(StorageLocation).filter(
            StorageLocation.code == r["storage_location"], 
            StorageLocation.plant_code == r["plant"]
        ).first()
        if not sl and r["storage_location"]:
            sl = StorageLocation(code=r["storage_location"], plant_code=r["plant"], name=f"Loc {r['storage_location']}")
            db.add(sl)
            db.commit()

        # Create WBS Element if not exists (associate with a default import project if WBS is present)
        if r["wbs"]:
            wbs_el = db.query(WbsElement).filter(WbsElement.code == r["wbs"]).first()
            if not wbs_el:
                # Ensure a default project exists
                from backend.models import Project
                proj = db.query(Project).filter(Project.code == "IMPORT_PROJ").first()
                if not proj:
                    proj = Project(code="IMPORT_PROJ", name="Imported Projects", description="System placeholder project for MB52 imports")
                    db.add(proj)
                    db.commit()
                wbs_el = WbsElement(code=r["wbs"], project_code="IMPORT_PROJ", description="Imported via MB52")
                db.add(wbs_el)
                db.commit()

        key = (r["material_code"], r["plant"], r["storage_location"], r["wbs"])
        upload_map[key] = r

    # Fetch all existing stock records
    existing_stocks = db.query(Stock).all()
    existing_map = {
        (s.material_code, s.plant_code, s.storage_location_code, s.wbs_code or ""): s 
        for s in existing_stocks
    }

    # Track keys processed
    processed_keys = set()

    # Compare MB52 uploaded items against current stock
    for key, r in upload_map.items():
        processed_keys.add(key)
        
        # Unpack key
        m_code, p_code, sl_code, wbs_code = key
        
        # Check if stock already exists in DB
        stock_record = existing_map.get(key)
        
        if stock_record:
            # Check for discrepancy in quantities
            old_qty = stock_record.available_qty
            new_qty = r["available_qty"]
            diff_qty = new_qty - old_qty
            
            # Check other quantities as well
            diff_blocked = r["blocked_qty"] - stock_record.blocked_qty
            diff_qi = r["quality_inspection_qty"] - stock_record.quality_inspection_qty
            diff_transit = r["transit_qty"] - stock_record.transit_qty
            
            has_diff = (diff_qty != 0.0 or diff_blocked != 0.0 or diff_qi != 0.0 or diff_transit != 0.0)
            
            if has_diff:
                # Log discrepancy
                discrepancy_count += 1
                diff_val = r["stock_value"] - stock_record.stock_value
                
                disc = Discrepancy(
                    upload_id=upload_history.id,
                    material_code=m_code,
                    material_description=r["description"],
                    plant=p_code,
                    storage_location=sl_code,
                    wbs=wbs_code,
                    old_qty=old_qty,
                    new_qty=new_qty,
                    diff_qty=diff_qty,
                    diff_value=diff_val,
                    reason="MB52 Upload Stock Mismatch",
                    status="Pending",
                    responsible_person=""
                )
                db.add(disc)
                
                # Update stock record in DB
                stock_record.available_qty = new_qty
                stock_record.blocked_qty = r["blocked_qty"]
                stock_record.quality_inspection_qty = r["quality_inspection_qty"]
                stock_record.transit_qty = r["transit_qty"]
                stock_record.stock_value = r["stock_value"]
        else:
            # New stock record entirely. Log if first ingestion, but usually it's just added directly.
            # However, if there are quantities, it means new stock is registered.
            # We add it as a new stock record.
            new_stock = Stock(
                material_code=m_code,
                plant_code=p_code,
                storage_location_code=sl_code,
                wbs_code=wbs_code if wbs_code else None,
                available_qty=r["available_qty"],
                blocked_qty=r["blocked_qty"],
                quality_inspection_qty=r["quality_inspection_qty"],
                transit_qty=r["transit_qty"],
                stock_value=r["stock_value"]
            )
            db.add(new_stock)

            # Record initial adjustment so it appears in the transaction ledger
            if r["available_qty"] > 0:
                disc = Discrepancy(
                    upload_id=upload_history.id,
                    material_code=m_code,
                    material_description=r["description"],
                    plant=p_code,
                    storage_location=sl_code,
                    wbs=wbs_code,
                    old_qty=0.0,
                    new_qty=r["available_qty"],
                    diff_qty=r["available_qty"],
                    diff_value=r["stock_value"],
                    reason="MB52 Ingestion Initial Stock",
                    status="Resolved",
                    responsible_person="System"
                )
                db.add(disc)

    # Check for items in DB that are missing in the MB52 upload (this means they became zero stock)
    for key, stock_record in existing_map.items():
        if key not in processed_keys:
            # If system had stock but MB52 has nothing, it means stock is now 0.
            if stock_record.available_qty > 0 or stock_record.blocked_qty > 0 or stock_record.quality_inspection_qty > 0:
                discrepancy_count += 1
                diff_val = -stock_record.stock_value
                
                disc = Discrepancy(
                    upload_id=upload_history.id,
                    material_code=stock_record.material_code,
                    material_description=db.query(Material.description).filter(Material.material_code == stock_record.material_code).scalar() or "",
                    plant=stock_record.plant_code,
                    storage_location=stock_record.storage_location_code,
                    wbs=stock_record.wbs_code or "",
                    old_qty=stock_record.available_qty,
                    new_qty=0.0,
                    diff_qty=-stock_record.available_qty,
                    diff_value=diff_val,
                    reason="Material missing in latest MB52 upload (assumed 0)",
                    status="Pending",
                    responsible_person=""
                )
                db.add(disc)
                
                # Zero out stock
                stock_record.available_qty = 0.0
                stock_record.blocked_qty = 0.0
                stock_record.quality_inspection_qty = 0.0
                stock_record.transit_qty = 0.0
                stock_record.stock_value = 0.0

    # Save updates
    upload_history.status = "Success"
    upload_history.discrepancies_found = discrepancy_count
    
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="MB52 Uploaded",
        remarks=f"Uploaded MB52 report '{file.filename}'. Found {discrepancy_count} discrepancies."
    )
    db.add(audit)
    db.commit()

    # Trigger alerts if discrepancies found
    if discrepancy_count > 0:
        # Find warehouse emails to alert
        users_to_alert = db.query(User).filter(User.role.in_(["Warehouse Manager", "Warehouse Supervisor", "Warehouse Worker"])).all()
        emails = [u.email for u in users_to_alert if u.email]
        
        subject = f"ALERT: {discrepancy_count} Stock Discrepancies Detected"
        body = f"""
        <html>
            <body>
                <h2>Warehouse Stock Discrepancy Alert</h2>
                <p>Hello Team,</p>
                <p>The latest SAP MB52 report upload has detected <b>{discrepancy_count}</b> stock discrepancy line(s) compared to the system stock record.</p>
                <p>Please log in to the Warehouse Operations Web Application to review the discrepancy report and take corrective actions.</p>
                <br/>
                <p><b>Upload details:</b></p>
                <ul>
                    <li>File name: {file.filename}</li>
                    <li>Uploaded by: {current_user.name} ({current_user.role})</li>
                    <li>Time: {upload_history.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')}</li>
                </ul>
                <p>Regards,<br/>Warehouse Operations System</p>
            </body>
        </html>
        """
        for email in emails:
            send_email_notification(subject, body, email, db)

    return upload_history

@router.get("/history", response_model=List[MB52UploadHistoryResponse])
def get_upload_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MB52UploadHistory).order_by(MB52UploadHistory.uploaded_at.desc()).all()

@router.get("/discrepancies", response_model=List[DiscrepancyResponse])
def get_discrepancies(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Discrepancy).order_by(Discrepancy.status.desc(), Discrepancy.created_at.desc()).all()

@router.post("/discrepancies/{disc_id}/resolve")
def resolve_discrepancy(
    disc_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager", "Warehouse Supervisor"]))
):
    disc = db.query(Discrepancy).filter(Discrepancy.id == disc_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
        
    reason = data.get("reason", "Resolved manually")
    responsible = data.get("responsible_person", current_user.name)
    
    disc.status = "Resolved"
    disc.reason = reason
    disc.responsible_person = responsible
    
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Discrepancy Resolved",
        remarks=f"Resolved discrepancy ID {disc_id} for material {disc.material_code}. Reason: {reason}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": f"Discrepancy {disc_id} marked as resolved."}
