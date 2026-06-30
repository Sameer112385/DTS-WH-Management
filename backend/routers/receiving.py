from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
from typing import List
from backend.database import get_db
from backend.models import MaterialReceiving, MaterialReceivingLineItem, Stock, Material, User, AuditTrail, Attachment, CompanySetting
from backend.schemas import MaterialReceivingCreate, MaterialReceivingResponse
from backend.auth import get_current_user, RoleChecker
from backend.config import settings
from backend.utils.pdf_generator import generate_receiving_pdf

router = APIRouter(prefix="/receiving", tags=["receiving"])

def generate_receiving_ref(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"MR-{today}-"
    count = db.query(MaterialReceiving).filter(MaterialReceiving.receiving_number.like(f"{prefix}%")).count()
    serial = str(count + 1).zfill(4)
    return f"{prefix}{serial}"

@router.post("/", response_model=MaterialReceivingResponse)
def create_receiving(
    rec_in: MaterialReceivingCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager", "Warehouse Supervisor", "Warehouse Worker"]))
):
    ref_num = generate_receiving_ref(db)
    
    rec = MaterialReceiving(
        receiving_number=ref_num,
        type=rec_in.type,
        supplier=rec_in.supplier,
        reference_number=rec_in.reference_number,
        received_by=current_user.name,
        checked_by=current_user.name, # Default for now
        received_date=rec_in.received_date,
        remarks=rec_in.remarks,
        status="Received"
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    
    # Process items
    for item in rec_in.line_items:
        # Create line item
        line = MaterialReceivingLineItem(
            receiving_id=rec.id,
            material_code=item.material_code,
            plant_code=item.plant_code,
            storage_location_code=item.storage_location_code,
            wbs_code=item.wbs_code if item.wbs_code else None,
            quantity=item.quantity,
            remarks=item.remarks
        )
        db.add(line)
        
        # Ensure Material exists in master, else error/placeholder
        mat = db.query(Material).filter(Material.material_code == item.material_code).first()
        if not mat:
            # Create a simple placeholder
            mat = Material(
                material_code=item.material_code,
                description=f"Auto Created Material {item.material_code}",
                uom="EA"
            )
            db.add(mat)
            db.commit()
            db.refresh(mat)

        # Update Stock: search by Material + Plant + Loc + WBS
        stock = db.query(Stock).filter(
            Stock.material_code == item.material_code,
            Stock.plant_code == item.plant_code,
            Stock.storage_location_code == item.storage_location_code,
            Stock.wbs_code == item.wbs_code
        ).first()
        
        if stock:
            # Calculate value increase
            val_per_unit = stock.stock_value / stock.available_qty if stock.available_qty > 0 else 10.0 # Default value logic
            stock.available_qty += item.quantity
            stock.stock_value += item.quantity * val_per_unit
        else:
            # Create new stock record
            stock = Stock(
                material_code=item.material_code,
                plant_code=item.plant_code,
                storage_location_code=item.storage_location_code,
                wbs_code=item.wbs_code if item.wbs_code else None,
                available_qty=item.quantity,
                blocked_qty=0.0,
                quality_inspection_qty=0.0,
                transit_qty=0.0,
                stock_value=item.quantity * 10.0 # Default $10 unit cost
            )
            db.add(stock)
            
    db.commit()
    db.refresh(rec)
    
    # Auto-generate PDF Form
    pdf_filename = f"receiving_{rec.receiving_number}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    comp = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    comp_name = comp.company_name if comp else "WAREHOUSE"
    comp_logo = comp.company_logo if comp else None
    
    rec_pdf_data = {
        "company_name": comp_name,
        "company_logo": comp_logo,
        "receiving_number": rec.receiving_number,
        "type": rec.type,
        "supplier": rec.supplier,
        "reference_number": rec.reference_number,
        "received_by": rec.received_by,
        "checked_by": rec.checked_by,
        "received_date": rec.received_date,
        "remarks": rec.remarks,
        "status": rec.status,
        "line_items": [
            {
                "material_code": line.material_code,
                "plant_code": line.plant_code,
                "storage_location_code": line.storage_location_code,
                "wbs_code": line.wbs_code,
                "quantity": line.quantity,
                "remarks": line.remarks
            } for line in rec.line_items
        ]
    }
    
    try:
        generate_receiving_pdf(rec_pdf_data, pdf_path, cancelled=False)
        attach = Attachment(
            transaction_type="Receiving",
            transaction_id=rec.id,
            filename=pdf_filename,
            file_path=f"/static/{pdf_filename}",
            uploaded_by="System"
        )
        db.add(attach)
        db.commit()
    except Exception as e:
        print(f"Failed to generate receiving PDF: {str(e)}")
        
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Material Received",
        remarks=f"Received material against {rec.type} Ref: {rec.reference_number}. Rec ID: {rec.receiving_number}"
    )
    db.add(audit)
    db.commit()
    
    return rec

@router.get("/", response_model=List[MaterialReceivingResponse])
def get_receivings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MaterialReceiving).order_by(MaterialReceiving.created_at.desc()).all()

@router.get("/{rec_id}/pdf")
def download_receiving_pdf(rec_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rec = db.query(MaterialReceiving).filter(MaterialReceiving.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receiving record not found")
        
    pdf_filename = f"receiving_{rec.receiving_number}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    if not os.path.exists(pdf_path):
        comp = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
        comp_name = comp.company_name if comp else "WAREHOUSE"
        comp_logo = comp.company_logo if comp else None
        
        rec_pdf_data = {
            "company_name": comp_name,
            "company_logo": comp_logo,
            "receiving_number": rec.receiving_number,
            "type": rec.type,
            "supplier": rec.supplier,
            "reference_number": rec.reference_number,
            "received_by": rec.received_by,
            "checked_by": rec.checked_by,
            "received_date": rec.received_date,
            "remarks": rec.remarks,
            "status": rec.status,
            "line_items": [
                {
                    "material_code": line.material_code,
                    "plant_code": line.plant_code,
                    "storage_location_code": line.storage_location_code,
                    "wbs_code": line.wbs_code,
                    "quantity": line.quantity,
                    "remarks": line.remarks
                } for line in rec.line_items
            ]
        }
        is_cancelled = (rec.status == "Cancelled")
        generate_receiving_pdf(rec_pdf_data, pdf_path, cancelled=is_cancelled)
        
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_filename)
