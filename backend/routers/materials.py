from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from backend.database import get_db
from backend.models import Material, Stock, User, WbsElement, MRF, MRFLineItem, MaterialTransfer, MaterialTransferLineItem, MaterialReceiving, MaterialReceivingLineItem, Discrepancy, AuditTrail
from backend.schemas import MaterialResponse, StockResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/materials", tags=["materials"])

# --- Pydantic schemas for Material CRUD ---
class MaterialCreate(BaseModel):
    material_code: str
    description: str
    uom: str
    material_type: Optional[str] = None
    material_group: Optional[str] = None

class MaterialUpdate(BaseModel):
    description: Optional[str] = None
    uom: Optional[str] = None
    material_type: Optional[str] = None
    material_group: Optional[str] = None

@router.get("/", response_model=List[MaterialResponse])
def list_materials(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Material).all()

@router.post("/", response_model=MaterialResponse)
def create_material(payload: MaterialCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new material in the catalog."""
    # Only Admin, Warehouse Manager, Warehouse Supervisor can create
    if current_user.role not in ("Admin", "Warehouse Manager", "Warehouse Supervisor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create materials.")
    
    existing = db.query(Material).filter(Material.material_code == payload.material_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Material code '{payload.material_code}' already exists.")
    
    mat = Material(
        material_code=payload.material_code.strip(),
        description=payload.description.strip(),
        uom=payload.uom.strip().upper(),
        material_type=payload.material_type.strip() if payload.material_type else None,
        material_group=payload.material_group.strip() if payload.material_group else None
    )
    db.add(mat)
    
    # Audit trail
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Material Created",
        remarks=f"Created material {mat.material_code}: {mat.description} (UOM: {mat.uom})"
    )
    db.add(audit)
    db.commit()
    db.refresh(mat)
    return mat

@router.put("/{material_code}", response_model=MaterialResponse)
def update_material(material_code: str, payload: MaterialUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update an existing material's details."""
    if current_user.role not in ("Admin", "Warehouse Manager", "Warehouse Supervisor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to update materials.")
    
    mat = db.query(Material).filter(Material.material_code == material_code).first()
    if not mat:
        raise HTTPException(status_code=404, detail=f"Material '{material_code}' not found.")
    
    changes = []
    if payload.description is not None and payload.description.strip():
        changes.append(f"description: '{mat.description}' → '{payload.description.strip()}'")
        mat.description = payload.description.strip()
    if payload.uom is not None and payload.uom.strip():
        changes.append(f"uom: '{mat.uom}' → '{payload.uom.strip().upper()}'")
        mat.uom = payload.uom.strip().upper()
    if payload.material_type is not None:
        changes.append(f"type: '{mat.material_type}' → '{payload.material_type.strip()}'")
        mat.material_type = payload.material_type.strip() if payload.material_type else None
    if payload.material_group is not None:
        changes.append(f"group: '{mat.material_group}' → '{payload.material_group.strip()}'")
        mat.material_group = payload.material_group.strip() if payload.material_group else None
    
    if changes:
        audit = AuditTrail(
            user_id=current_user.id,
            username=current_user.username,
            action="Material Updated",
            remarks=f"Updated material {material_code}: {'; '.join(changes)}"
        )
        db.add(audit)
    
    db.commit()
    db.refresh(mat)
    return mat

@router.delete("/{material_code}")
def delete_material(material_code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a material only if it has no stock records or transaction references."""
    if current_user.role not in ("Admin", "Warehouse Manager"):
        raise HTTPException(status_code=403, detail="Only Admin or Warehouse Manager can delete materials.")
    
    mat = db.query(Material).filter(Material.material_code == material_code).first()
    if not mat:
        raise HTTPException(status_code=404, detail=f"Material '{material_code}' not found.")
    
    # Check for existing stock
    stock_count = db.query(Stock).filter(Stock.material_code == material_code).count()
    if stock_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete material '{material_code}' — it has {stock_count} stock record(s). Remove stock first.")
    
    # Check for transaction references
    mrf_count = db.query(MRFLineItem).filter(MRFLineItem.material_code == material_code).count()
    rec_count = db.query(MaterialReceivingLineItem).filter(MaterialReceivingLineItem.material_code == material_code).count()
    tx_count = db.query(MaterialTransferLineItem).filter(MaterialTransferLineItem.material_code == material_code).count()
    
    if mrf_count + rec_count + tx_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete material '{material_code}' — it is referenced in {mrf_count + rec_count + tx_count} transaction(s).")
    
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Material Deleted",
        remarks=f"Deleted material {material_code}: {mat.description}"
    )
    db.add(audit)
    db.delete(mat)
    db.commit()
    return {"detail": f"Material '{material_code}' deleted successfully."}


@router.get("/stock", response_model=List[StockResponse])
def get_stock(
    material_code: Optional[str] = None,
    plant_code: Optional[str] = None,
    storage_location_code: Optional[str] = None,
    wbs_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Stock)
    if material_code:
        query = query.filter(Stock.material_code.ilike(f"%{material_code}%"))
    if plant_code:
        query = query.filter(Stock.plant_code == plant_code)
    if storage_location_code:
        query = query.filter(Stock.storage_location_code == storage_location_code)
    if wbs_code:
        query = query.filter(Stock.wbs_code.ilike(f"%{wbs_code}%"))
        
    return query.all()

@router.get("/stock/search")
def search_stock(
    search_term: Optional[str] = None,
    plant_code: Optional[str] = None,
    storage_location_code: Optional[str] = None,
    wbs_code: Optional[str] = None,
    project_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search stock by material code, description, plant, storage location, or WBS element.
    Allows filtering by plant, storage location, WBS, or Project.
    Returns merged Stock + Material details.
    """
    query = db.query(Stock, Material).join(Material, Stock.material_code == Material.material_code)
    
    if search_term:
        term = f"%{search_term}%"
        query = query.filter(
            Stock.material_code.ilike(term) |
            Material.description.ilike(term) |
            Stock.plant_code.ilike(term) |
            Stock.storage_location_code.ilike(term) |
            Stock.wbs_code.ilike(term)
        )
        
    if plant_code:
        query = query.filter(Stock.plant_code == plant_code)
        
    if storage_location_code:
        query = query.filter(Stock.storage_location_code == storage_location_code)
        
    if wbs_code:
        query = query.filter(Stock.wbs_code == wbs_code)
        
    if project_code:
        query = query.join(WbsElement, Stock.wbs_code == WbsElement.code).filter(WbsElement.project_code == project_code)
        
    results = query.all()
    
    output = []
    for stock, mat in results:
        output.append({
            "id": stock.id,
            "material_code": stock.material_code,
            "description": mat.description,
            "uom": mat.uom,
            "material_type": mat.material_type,
            "material_group": mat.material_group,
            "plant_code": stock.plant_code,
            "storage_location_code": stock.storage_location_code,
            "wbs_code": stock.wbs_code,
            "available_qty": stock.available_qty,
            "blocked_qty": stock.blocked_qty,
            "quality_inspection_qty": stock.quality_inspection_qty,
            "transit_qty": stock.transit_qty,
            "stock_value": stock.stock_value,
            "updated_at": stock.updated_at
        })
        
    return output

@router.get("/{material_code}/transactions")
def get_material_transactions(material_code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Fetch MRFs (Issuances)
    mrfs = db.query(MRF, MRFLineItem).join(MRFLineItem, MRF.id == MRFLineItem.mrf_id).filter(
        MRFLineItem.material_code == material_code
    ).all()
    
    # 2. Fetch Transfers
    transfers = db.query(MaterialTransfer, MaterialTransferLineItem).join(
        MaterialTransferLineItem, MaterialTransfer.id == MaterialTransferLineItem.transfer_id
    ).filter(
        MaterialTransferLineItem.material_code == material_code
    ).all()
    
    # 3. Fetch Receivings
    receivings = db.query(MaterialReceiving, MaterialReceivingLineItem).join(
        MaterialReceivingLineItem, MaterialReceiving.id == MaterialReceivingLineItem.receiving_id
    ).filter(
        MaterialReceivingLineItem.material_code == material_code
    ).all()
    
    # 4. Fetch Discrepancies (Stock Adjustments)
    discrepancies = db.query(Discrepancy).filter(Discrepancy.material_code == material_code).all()
    
    tx_list = []
    
    # Format issuances
    for mrf, item in mrfs:
        assignment = (
            f"Cost Center: {mrf.cost_center_code}"
            if getattr(mrf, "issue_account_type", "project") == "cost_center"
            else f"Project: {mrf.project_code}"
        )
        tx_list.append({
            "type": "Issuance",
            "date": mrf.date or mrf.created_at.strftime("%Y-%m-%d"),
            "reference": mrf.reference_number,
            "quantity": -item.issued_qty if mrf.status == "Issued" else 0.0,
            "requested_qty": item.requested_qty,
            "approved_qty": item.approved_qty,
            "issued_qty": item.issued_qty,
            "details": f"To {assignment}, WBS: {item.wbs_code or mrf.wbs_code or 'N/A'}. Requestor: {mrf.requested_by_name}",
            "status": mrf.status
        })
        
    # Format transfers
    for transfer, item in transfers:
        tx_list.append({
            "type": "Transfer",
            "date": transfer.created_at.strftime("%Y-%m-%d") if transfer.created_at else "",
            "reference": transfer.transfer_number,
            "quantity": -item.quantity if transfer.status == "Transferred" else 0.0,
            "details": f"Source: {transfer.source_plant}/{transfer.source_storage_location} -> Dest: {transfer.dest_plant}/{transfer.dest_storage_location}",
            "status": transfer.status
        })
        
    # Format receivings
    for rec, item in receivings:
        tx_list.append({
            "type": "Receiving",
            "date": rec.received_date or (rec.created_at.strftime("%Y-%m-%d") if rec.created_at else ""),
            "reference": rec.receiving_number,
            "quantity": item.quantity,
            "details": f"Type: {rec.type}. Supplier: {rec.supplier or 'N/A'}. Dest: {item.plant_code}/{item.storage_location_code}",
            "status": rec.status
        })
        
    # Format discrepancies
    for disc in discrepancies:
        tx_list.append({
            "type": "Stock Adjustment",
            "date": disc.created_at.strftime("%Y-%m-%d") if disc.created_at else "",
            "reference": f"Disc #{disc.id}",
            "quantity": disc.diff_qty,
            "details": f"Reason: {disc.reason or 'SAP Sync mismatch'}. Plant: {disc.plant}, Loc: {disc.storage_location}",
            "status": disc.status
        })
        
    # Sort by date descending
    tx_list.sort(key=lambda x: (x["date"] or "", x["reference"] or ""), reverse=True)
    return tx_list
