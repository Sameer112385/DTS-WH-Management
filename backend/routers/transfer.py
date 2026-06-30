from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
from typing import List
from backend.database import get_db
from backend.models import MaterialTransfer, MaterialTransferLineItem, Stock, User, AuditTrail, Attachment
from backend.schemas import MaterialTransferCreate, MaterialTransferResponse
from backend.auth import get_current_user, RoleChecker
from backend.config import settings
from backend.utils.pdf_generator import generate_transfer_pdf

router = APIRouter(prefix="/transfer", tags=["transfer"])

def generate_transfer_ref(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"TR-{today}-"
    count = db.query(MaterialTransfer).filter(MaterialTransfer.transfer_number.like(f"{prefix}%")).count()
    serial = str(count + 1).zfill(4)
    return f"{prefix}{serial}"

@router.post("/", response_model=MaterialTransferResponse)
def create_transfer_request(
    trans_in: MaterialTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if we have source stock before allowing creation of request
    for item in trans_in.line_items:
        source_stock = db.query(Stock).filter(
            Stock.material_code == item.material_code,
            Stock.plant_code == trans_in.source_plant,
            Stock.storage_location_code == trans_in.source_storage_location,
            Stock.wbs_code == trans_in.source_wbs
        ).first()
        
        if not source_stock or source_stock.available_qty < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient source stock for material {item.material_code}. Available: {source_stock.available_qty if source_stock else 0.0}, Requested: {item.quantity}"
            )
            
    ref_num = generate_transfer_ref(db)
    
    # Create transfer record
    transfer = MaterialTransfer(
        transfer_number=ref_num,
        source_plant=trans_in.source_plant,
        source_storage_location=trans_in.source_storage_location,
        dest_plant=trans_in.dest_plant,
        dest_storage_location=trans_in.dest_storage_location,
        source_wbs=trans_in.source_wbs if trans_in.source_wbs else None,
        dest_wbs=trans_in.dest_wbs if trans_in.dest_wbs else None,
        requested_by=current_user.name,
        status="Pending Approval",
        remarks=trans_in.remarks
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    
    # Line items
    for item in trans_in.line_items:
        line = MaterialTransferLineItem(
            transfer_id=transfer.id,
            material_code=item.material_code,
            quantity=item.quantity
        )
        db.add(line)
        
    db.commit()
    db.refresh(transfer)
    
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Transfer Requested",
        remarks=f"Requested transfer {transfer.transfer_number} from {transfer.source_plant}/{transfer.source_storage_location} to {transfer.dest_plant}/{transfer.dest_storage_location}"
    )
    db.add(audit)
    db.commit()
    
    return transfer

@router.get("/", response_model=List[MaterialTransferResponse])
def get_transfers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MaterialTransfer).order_by(MaterialTransfer.created_at.desc()).all()

@router.post("/{transfer_id}/approve", response_model=MaterialTransferResponse)
def approve_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager", "Warehouse Supervisor"]))
):
    transfer = db.query(MaterialTransfer).filter(MaterialTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
        
    if transfer.status != "Pending Approval":
        raise HTTPException(status_code=400, detail=f"Cannot approve transfer in status '{transfer.status}'")
        
    # Execute stock movement
    for item in transfer.line_items:
        # 1. Source stock
        source_stock = db.query(Stock).filter(
            Stock.material_code == item.material_code,
            Stock.plant_code == transfer.source_plant,
            Stock.storage_location_code == transfer.source_storage_location,
            Stock.wbs_code == transfer.source_wbs
        ).first()
        
        if not source_stock or source_stock.available_qty < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Approval failed: Insufficient source stock for {item.material_code} during execution."
            )
            
        # Calculate proportionate value
        val_per_unit = source_stock.stock_value / source_stock.available_qty if source_stock.available_qty > 0 else 10.0
        moved_value = item.quantity * val_per_unit
        
        source_stock.available_qty -= item.quantity
        source_stock.stock_value -= moved_value
        
        # 2. Destination stock
        dest_stock = db.query(Stock).filter(
            Stock.material_code == item.material_code,
            Stock.plant_code == transfer.dest_plant,
            Stock.storage_location_code == transfer.dest_storage_location,
            Stock.wbs_code == transfer.dest_wbs
        ).first()
        
        if dest_stock:
            dest_stock.available_qty += item.quantity
            dest_stock.stock_value += moved_value
        else:
            # Create new destination stock
            dest_stock = Stock(
                material_code=item.material_code,
                plant_code=transfer.dest_plant,
                storage_location_code=transfer.dest_storage_location,
                wbs_code=transfer.dest_wbs if transfer.dest_wbs else None,
                available_qty=item.quantity,
                blocked_qty=0.0,
                quality_inspection_qty=0.0,
                transit_qty=0.0,
                stock_value=moved_value
            )
            db.add(dest_stock)
            
    transfer.status = "Transferred"
    transfer.approved_by = current_user.name
    
    # Save updates
    db.commit()
    db.refresh(transfer)
    
    # Generate Transfer PDF Form
    pdf_filename = f"transfer_{transfer.transfer_number}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    trans_pdf_data = {
        "transfer_number": transfer.transfer_number,
        "source_plant": transfer.source_plant,
        "source_storage_location": transfer.source_storage_location,
        "dest_plant": transfer.dest_plant,
        "dest_storage_location": transfer.dest_storage_location,
        "source_wbs": transfer.source_wbs,
        "dest_wbs": transfer.dest_wbs,
        "requested_by": transfer.requested_by,
        "approved_by": transfer.approved_by,
        "status": transfer.status,
        "remarks": transfer.remarks,
        "line_items": [
            {
                "material_code": line.material_code,
                "quantity": line.quantity
            } for line in transfer.line_items
        ]
    }
    
    try:
        generate_transfer_pdf(trans_pdf_data, pdf_path, cancelled=False)
        attach = Attachment(
            transaction_type="Transfer",
            transaction_id=transfer.id,
            filename=pdf_filename,
            file_path=f"/static/{pdf_filename}",
            uploaded_by="System"
        )
        db.add(attach)
        db.commit()
    except Exception as e:
        print(f"Failed to generate transfer PDF: {str(e)}")
        
    # Audit log
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Transfer Approved",
        remarks=f"Approved and executed transfer {transfer.transfer_number}"
    )
    db.add(audit)
    db.commit()
    
    return transfer

@router.get("/{transfer_id}/pdf")
def download_transfer_pdf(transfer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transfer = db.query(MaterialTransfer).filter(MaterialTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found")
        
    pdf_filename = f"transfer_{transfer.transfer_number}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    if not os.path.exists(pdf_path):
        trans_pdf_data = {
            "transfer_number": transfer.transfer_number,
            "source_plant": transfer.source_plant,
            "source_storage_location": transfer.source_storage_location,
            "dest_plant": transfer.dest_plant,
            "dest_storage_location": transfer.dest_storage_location,
            "source_wbs": transfer.source_wbs,
            "dest_wbs": transfer.dest_wbs,
            "requested_by": transfer.requested_by,
            "approved_by": transfer.approved_by,
            "status": transfer.status,
            "remarks": transfer.remarks,
            "line_items": [
                {
                    "material_code": line.material_code,
                    "quantity": line.quantity
                } for line in transfer.line_items
            ]
        }
        is_cancelled = (transfer.status == "Cancelled")
        generate_transfer_pdf(trans_pdf_data, pdf_path, cancelled=is_cancelled)
        
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_filename)
