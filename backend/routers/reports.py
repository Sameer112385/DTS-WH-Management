from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os
from backend.database import get_db
from backend.models import (
    MRF, MRFLineItem, MaterialReceiving, MaterialReceivingLineItem,
    MaterialTransfer, MaterialTransferLineItem, Stock, Material, 
    Cancellation, AuditTrail, User, Discrepancy, StockIssueMovement
)
from backend.schemas import CancellationCreate, CancellationResponse
from backend.auth import get_current_user, RoleChecker
from backend.config import settings
from backend.utils.pdf_generator import generate_mrf_pdf, generate_receiving_pdf, generate_transfer_pdf

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/dashboard")
def get_dashboard_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Calculate key metrics
    total_materials = db.query(Material).count()
    total_stock_val = sum([s.stock_value for s in db.query(Stock).all()])
    
    # Low stock items (available qty < 5.0 and > 0)
    low_stock = db.query(Stock).filter(Stock.available_qty > 0.0, Stock.available_qty < 5.0).count()
    # Zero stock items
    zero_stock = db.query(Stock).filter(Stock.available_qty == 0.0).count()
    
    blocked_stock_qty = sum([s.blocked_qty for s in db.query(Stock).all()])
    qi_stock_qty = sum([s.quality_inspection_qty for s in db.query(Stock).all()])
    transit_stock_qty = sum([s.transit_qty for s in db.query(Stock).all()])
    
    # Pendings
    pending_mrfs = db.query(MRF).filter(MRF.status.like("Pending%")).count()
    pending_receivings = db.query(MaterialReceiving).filter(MaterialReceiving.status == "Pending").count()
    pending_transfers = db.query(MaterialTransfer).filter(MaterialTransfer.status == "Pending Approval").count()
    
    # Alerts
    discrepancy_alerts = db.query(Discrepancy).filter(Discrepancy.status == "Pending").count()
    cancelled_txs = db.query(Cancellation).count()
    
    # Recent activity
    recent_mrfs = db.query(MRF).order_by(MRF.created_at.desc()).limit(5).all()
    recent_discrepancies = db.query(Discrepancy).order_by(Discrepancy.created_at.desc()).limit(5).all()
    
    # Calculate last 6 months statistics for charts
    chart_map = {}
    now = datetime.utcnow()
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        month_name = datetime(year, month, 1).strftime("%b")
        chart_map[(year, month)] = {
            "name": month_name,
            "Issuances": 0.0,
            "Transfers": 0.0,
            "Receivings": 0.0
        }

    receivings = db.query(MaterialReceiving).filter(MaterialReceiving.status != "Cancelled").all()
    for rec in receivings:
        date_val = rec.created_at
        if rec.received_date:
            try:
                date_val = datetime.strptime(rec.received_date.split()[0], "%Y-%m-%d")
            except Exception:
                try:
                    date_val = datetime.strptime(rec.received_date.split()[0], "%d-%m-%Y")
                except Exception:
                    pass
        if date_val:
            key = (date_val.year, date_val.month)
            if key in chart_map:
                chart_map[key]["Receivings"] += sum([item.quantity for item in rec.line_items])

    mrfs = db.query(MRF).filter(MRF.status == "Issued").all()
    for mrf in mrfs:
        date_val = mrf.created_at
        if mrf.date:
            try:
                date_val = datetime.strptime(mrf.date.split()[0], "%Y-%m-%d")
            except Exception:
                try:
                    date_val = datetime.strptime(mrf.date.split()[0], "%d-%m-%Y")
                except Exception:
                    pass
        if date_val:
            key = (date_val.year, date_val.month)
            if key in chart_map:
                chart_map[key]["Issuances"] += sum([item.issued_qty for item in mrf.line_items])

    transfers = db.query(MaterialTransfer).filter(MaterialTransfer.status == "Transferred").all()
    for tr in transfers:
        date_val = tr.created_at
        if date_val:
            key = (date_val.year, date_val.month)
            if key in chart_map:
                chart_map[key]["Transfers"] += sum([item.quantity for item in tr.line_items])

    # Convert mapping keys to list sorted by year/month to ensure order
    sorted_keys = sorted(chart_map.keys())
    chart_data = [chart_map[k] for k in sorted_keys]

    return {
        "total_materials": total_materials,
        "total_stock_value": total_stock_val,
        "low_stock_items": low_stock,
        "zero_stock_items": zero_stock,
        "blocked_stock_qty": blocked_stock_qty,
        "quality_inspection_qty": qi_stock_qty,
        "transit_stock_qty": transit_stock_qty,
        "pending_mrfs": pending_mrfs,
        "pending_receivings": pending_receivings,
        "pending_transfers": pending_transfers,
        "discrepancy_alerts": discrepancy_alerts,
        "cancelled_transactions": cancelled_txs,
        "chart_data": chart_data,
        "recent_mrfs": [
            {
                "id": m.id,
                "ref": m.reference_number,
                "date": m.date,
                "requested_by": m.requested_by_name,
                "status": m.status,
                "qty": m.total_qty
            } for m in recent_mrfs
        ],
        "recent_discrepancies": [
            {
                "id": d.id,
                "material_code": d.material_code,
                "plant": d.plant,
                "storage_location": d.storage_location,
                "old_qty": d.old_qty,
                "new_qty": d.new_qty,
                "diff_qty": d.diff_qty,
                "status": d.status
            } for d in recent_discrepancies
        ]
    }

@router.post("/cancel", response_model=CancellationResponse)
def cancel_transaction(
    req: CancellationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Warehouse Manager"]))
):
    tx_type = req.transaction_type
    tx_id = req.transaction_id
    reason = req.reason
    
    impact = {}
    ref_num = ""
    
    # 1. Reverse stock based on transaction type
    if tx_type == "MRF":
        mrf = db.query(MRF).filter(MRF.id == tx_id).first()
        if not mrf:
            raise HTTPException(status_code=404, detail="MRF not found")
        if mrf.status == "Cancelled":
            raise HTTPException(status_code=400, detail="MRF is already cancelled")
            
        ref_num = mrf.reference_number
        impact["reference"] = ref_num
        impact["items"] = []
        
        # Only reverse stock if it was actually issued
        if mrf.status == "Issued":
            movements = db.query(StockIssueMovement).filter(StockIssueMovement.mrf_id == mrf.id).all()
            if not movements:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot cancel this issuance safely because its exact stock movements were not recorded."
                )

            for movement in movements:
                stock = None
                if movement.stock_id:
                    stock = db.query(Stock).filter(Stock.id == movement.stock_id).first()

                if not stock:
                    stock = db.query(Stock).filter(
                        Stock.material_code == movement.material_code,
                        Stock.plant_code == movement.plant_code,
                        Stock.storage_location_code == movement.storage_location_code,
                        Stock.wbs_code == movement.wbs_code
                    ).first()

                if not stock:
                    stock = Stock(
                        material_code=movement.material_code,
                        plant_code=movement.plant_code,
                        storage_location_code=movement.storage_location_code,
                        wbs_code=movement.wbs_code,
                        available_qty=0.0,
                        stock_value=0.0
                    )
                    db.add(stock)

                stock.available_qty += movement.quantity
                stock.stock_value += movement.stock_value

                impact["items"].append({
                    "material_code": movement.material_code,
                    "plant_code": movement.plant_code,
                    "storage_location_code": movement.storage_location_code,
                    "wbs_code": movement.wbs_code,
                    "reversed_qty": movement.quantity,
                    "reversed_value": movement.stock_value,
                    "action": "re-added to original stock source"
                })
                
        mrf.status = "Cancelled"
        
        # Regenerate PDF with watermark
        pdf_filename = f"mrf_{mrf.reference_number}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
        try:
            mrf_pdf_data = {
                "reference_number": mrf.reference_number,
                "date": mrf.date,
                "requested_by_name": mrf.requested_by_name,
                "project_name": mrf.project_code,
                "wbs_code": mrf.wbs_code or "N/A",
                "warehouse_name": "Warehouse",
                "reference_pr": mrf.reference_pr or "",
                "reference_po": mrf.reference_po or "",
                "warehouse_poc_name": mrf.warehouse_poc_name,
                "warehouse_poc_mobile": mrf.warehouse_poc_mobile,
                "additional_poc_name": mrf.additional_poc_name,
                "additional_poc_mobile": mrf.additional_poc_mobile,
                "location": mrf.location,
                "purpose": mrf.purpose,
                
                "vehicle_number": mrf.vehicle_number,
                "vehicle_type": mrf.vehicle_type,
                "driver_name": mrf.driver_name,
                "driver_mobile": mrf.driver_mobile,
                "driver_iqama": mrf.driver_iqama,
                "transport_company": mrf.transport_company,
                "receiver_name": mrf.receiver_name,
                "receiver_mobile": mrf.receiver_mobile,
                
                "requestor_signature": mrf.requestor_signature,
                "requestor_manager_signature": mrf.requestor_manager_signature,
                "project_manager_signature": mrf.project_manager_signature,
                "supervisor_signature": mrf.supervisor_signature,
                "manager_signature": mrf.manager_signature,
                "driver_signature": mrf.driver_signature,
                "receiver_signature": mrf.receiver_signature,
                
                "requestor_manager_name": mrf.requestor_manager_name,
                "requestor_manager_email": mrf.requestor_manager_email,
                "project_manager_name": mrf.project_manager_name,
                "project_manager_email": mrf.project_manager_email,
                "supervisor_name": mrf.supervisor_name,
                "manager_name": mrf.manager_name,
                
                "line_items": [
                    {
                        "material_code": line.material_code,
                        "description": line.description,
                        "uom": line.uom,
                        "requested_qty": line.requested_qty,
                        "approved_qty": line.approved_qty,
                        "issued_qty": line.issued_qty,
                        "wbs_code": line.wbs_code
                    } for line in mrf.line_items
                ]
            }
            generate_mrf_pdf(mrf_pdf_data, pdf_path, cancelled=True)
        except Exception as e:
            print(f"Failed to regenerate cancelled MRF PDF: {str(e)}")

    elif tx_type == "Receiving":
        rec = db.query(MaterialReceiving).filter(MaterialReceiving.id == tx_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Receiving record not found")
        if rec.status == "Cancelled":
            raise HTTPException(status_code=400, detail="Receiving record is already cancelled")
            
        ref_num = rec.receiving_number
        impact["reference"] = ref_num
        impact["items"] = []
        
        # Reverse received stock
        for line in rec.line_items:
            stock = db.query(Stock).filter(
                Stock.material_code == line.material_code,
                Stock.plant_code == line.plant_code,
                Stock.storage_location_code == line.storage_location_code,
                Stock.wbs_code == line.wbs_code
            ).first()
            
            if stock:
                # Deduct qty
                if stock.available_qty < line.quantity:
                    # Stock is lower than received, meaning some was issued.
                    # Standard rule: block cancellation or allow negative depending on config.
                    # Let's prevent cancellation if stock goes negative
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Cannot cancel receiving: Material {line.material_code} has already been issued from stock. Available: {stock.available_qty}, trying to reverse: {line.quantity}"
                    )
                stock.available_qty -= line.quantity
                # Deduct value
                val_per_unit = stock.stock_value / (stock.available_qty + line.quantity)
                stock.stock_value -= line.quantity * val_per_unit
                
                impact["items"].append({
                    "material_code": line.material_code,
                    "reversed_qty": -line.quantity,
                    "action": "deducted from stock"
                })
                
        rec.status = "Cancelled"
        
        # Regenerate PDF with watermark
        pdf_filename = f"receiving_{rec.receiving_number}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
        try:
            rec_pdf_data = {
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
            generate_receiving_pdf(rec_pdf_data, pdf_path, cancelled=True)
        except Exception as e:
            print(f"Failed to regenerate cancelled Receiving PDF: {str(e)}")

    elif tx_type == "Transfer":
        trans = db.query(MaterialTransfer).filter(MaterialTransfer.id == tx_id).first()
        if not trans:
            raise HTTPException(status_code=404, detail="Transfer not found")
        if trans.status == "Cancelled":
            raise HTTPException(status_code=400, detail="Transfer is already cancelled")
            
        ref_num = trans.transfer_number
        impact["reference"] = ref_num
        impact["items"] = []
        
        if trans.status == "Transferred":
            # Reverse: deduct from destination, add to source
            for line in trans.line_items:
                dest_stock = db.query(Stock).filter(
                    Stock.material_code == line.material_code,
                    Stock.plant_code == trans.dest_plant,
                    Stock.storage_location_code == trans.dest_storage_location,
                    Stock.wbs_code == trans.dest_wbs
                ).first()
                
                if not dest_stock or dest_stock.available_qty < line.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot cancel transfer: Destination stock for {line.material_code} is insufficient to reverse. Available: {dest_stock.available_qty if dest_stock else 0.0}, trying to reverse: {line.quantity}"
                    )
                
                # Deduct from destination
                val_per_unit = dest_stock.stock_value / dest_stock.available_qty if dest_stock.available_qty > 0 else 10.0
                moved_value = line.quantity * val_per_unit
                dest_stock.available_qty -= line.quantity
                dest_stock.stock_value -= moved_value
                
                # Add back to source
                src_stock = db.query(Stock).filter(
                    Stock.material_code == line.material_code,
                    Stock.plant_code == trans.source_plant,
                    Stock.storage_location_code == trans.source_storage_location,
                    Stock.wbs_code == trans.source_wbs
                ).first()
                
                if src_stock:
                    src_stock.available_qty += line.quantity
                    src_stock.stock_value += moved_value
                else:
                    src_stock = Stock(
                        material_code=line.material_code,
                        plant_code=trans.source_plant,
                        storage_location_code=trans.source_storage_location,
                        wbs_code=trans.source_wbs,
                        available_qty=line.quantity,
                        stock_value=moved_value
                    )
                    db.add(src_stock)
                    
                impact["items"].append({
                    "material_code": line.material_code,
                    "qty": line.quantity,
                    "action": "moved back from dest to source"
                })
                
        trans.status = "Cancelled"
        
        # Regenerate PDF with watermark
        pdf_filename = f"transfer_{trans.transfer_number}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
        try:
            trans_pdf_data = {
                "transfer_number": trans.transfer_number,
                "source_plant": trans.source_plant,
                "source_storage_location": trans.source_storage_location,
                "dest_plant": trans.dest_plant,
                "dest_storage_location": trans.dest_storage_location,
                "source_wbs": trans.source_wbs,
                "dest_wbs": trans.dest_wbs,
                "requested_by": trans.requested_by,
                "approved_by": trans.approved_by,
                "status": trans.status,
                "remarks": trans.remarks,
                "line_items": [
                    {
                        "material_code": line.material_code,
                        "quantity": line.quantity
                    } for line in trans.line_items
                ]
            }
            generate_transfer_pdf(trans_pdf_data, pdf_path, cancelled=True)
        except Exception as e:
            print(f"Failed to regenerate cancelled Transfer PDF: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type for cancellation")
        
    # Save cancellation record
    cancellation = Cancellation(
        transaction_type=tx_type,
        transaction_id=tx_id,
        cancelled_by=current_user.name,
        reason=reason,
        original_ref_number=ref_num,
        stock_impact_json=impact
    )
    db.add(cancellation)
    
    # Audit trail
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Transaction Cancelled",
        remarks=f"Cancelled {tx_type} Ref: {ref_num}. Reason: {reason}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(cancellation)
    
    return cancellation

@router.get("/cancellations", response_model=List[CancellationResponse])
def get_cancellation_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Cancellation).order_by(Cancellation.cancelled_at.desc()).all()

@router.get("/inventory-ledger")
def get_inventory_ledger(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    material_code: Optional[str] = None,
    tx_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    def normalize_date(date_val):
        if isinstance(date_val, datetime):
            return date_val
        if not date_val:
            return datetime.min
        try:
            return datetime.strptime(date_val.split()[0], "%Y-%m-%d")
        except Exception:
            pass
        try:
            return datetime.strptime(date_val.split()[0], "%d-%m-%Y")
        except Exception:
            pass
        return datetime.min

    materials_dict = {m.material_code: m.description for m in db.query(Material).all()}
    ledger_items = []

    # 1. Gather Receivings
    receivings = db.query(MaterialReceiving, MaterialReceivingLineItem).join(
        MaterialReceivingLineItem, MaterialReceiving.id == MaterialReceivingLineItem.receiving_id
    ).filter(MaterialReceiving.status != "Cancelled").all()
    for rec, item in receivings:
        ts = normalize_date(rec.received_date or rec.created_at)
        ledger_items.append({
            "timestamp": ts,
            "date": rec.received_date or (rec.created_at.strftime("%Y-%m-%d") if rec.created_at else ""),
            "material_code": item.material_code,
            "description": materials_dict.get(item.material_code, "Unknown Material"),
            "plant_code": item.plant_code,
            "storage_location_code": item.storage_location_code,
            "wbs_code": item.wbs_code or "",
            "tx_type": "Receiving",
            "reference": rec.receiving_number,
            "change_qty": item.quantity
        })

    # 2. Gather MRFs (Issuances)
    mrfs = db.query(MRF, MRFLineItem).join(
        MRFLineItem, MRF.id == MRFLineItem.mrf_id
    ).filter(MRF.status == "Issued").all()
    for mrf, item in mrfs:
        ts = normalize_date(mrf.date or mrf.created_at)
        assignment_ref = mrf.cost_center_code if getattr(mrf, "issue_account_type", "project") == "cost_center" else mrf.project_code
        assignment_type = "Cost Center" if getattr(mrf, "issue_account_type", "project") == "cost_center" else "Project"
        ledger_items.append({
            "timestamp": ts,
            "date": mrf.date or (mrf.created_at.strftime("%Y-%m-%d") if mrf.created_at else ""),
            "material_code": item.material_code,
            "description": materials_dict.get(item.material_code, "Unknown Material"),
            "plant_code": item.plant_code or "PL01",
            "storage_location_code": item.storage_location_code or "SL01",
            "wbs_code": item.wbs_code or mrf.wbs_code or "",
            "tx_type": "Issuance",
            "reference": f"{mrf.reference_number} ({assignment_type}: {assignment_ref or 'N/A'})",
            "change_qty": -item.issued_qty
        })

    # 3. Gather Transfers
    transfers = db.query(MaterialTransfer, MaterialTransferLineItem).join(
        MaterialTransferLineItem, MaterialTransfer.id == MaterialTransferLineItem.transfer_id
    ).filter(MaterialTransfer.status == "Transferred").all()
    for transfer, item in transfers:
        ts = normalize_date(transfer.created_at)
        ledger_items.append({
            "timestamp": ts,
            "date": transfer.created_at.strftime("%Y-%m-%d") if transfer.created_at else "",
            "material_code": item.material_code,
            "description": materials_dict.get(item.material_code, "Unknown Material"),
            "plant_code": transfer.source_plant,
            "storage_location_code": transfer.source_storage_location,
            "wbs_code": transfer.source_wbs or "",
            "tx_type": "Transfer Out",
            "reference": transfer.transfer_number,
            "change_qty": -item.quantity
        })
        ledger_items.append({
            "timestamp": ts,
            "date": transfer.created_at.strftime("%Y-%m-%d") if transfer.created_at else "",
            "material_code": item.material_code,
            "description": materials_dict.get(item.material_code, "Unknown Material"),
            "plant_code": transfer.dest_plant,
            "storage_location_code": transfer.dest_storage_location,
            "wbs_code": transfer.dest_wbs or "",
            "tx_type": "Transfer In",
            "reference": transfer.transfer_number,
            "change_qty": item.quantity
        })

    # 4. Gather Discrepancies
    discrepancies = db.query(Discrepancy).all()
    for disc in discrepancies:
        ts = normalize_date(disc.created_at)
        ledger_items.append({
            "timestamp": ts,
            "date": disc.created_at.strftime("%Y-%m-%d") if disc.created_at else "",
            "material_code": disc.material_code,
            "description": materials_dict.get(disc.material_code, disc.material_description or "Unknown Material"),
            "plant_code": disc.plant,
            "storage_location_code": disc.storage_location,
            "wbs_code": disc.wbs or "",
            "tx_type": "Stock Adjustment",
            "reference": f"Adjustment #{disc.id}",
            "change_qty": disc.diff_qty
        })

    ledger_items.sort(key=lambda x: x["timestamp"])

    running_balances = {}
    for item in ledger_items:
        key = (item["material_code"], item["plant_code"], item["storage_location_code"], item["wbs_code"])
        prev_qty = running_balances.get(key, 0.0)
        new_qty = prev_qty + item["change_qty"]
        running_balances[key] = new_qty
        item["prev_qty"] = prev_qty
        item["new_qty"] = new_qty

    ledger_items.sort(key=lambda x: x["timestamp"], reverse=True)

    filtered_items = []
    for item in ledger_items:
        if material_code and material_code.lower() not in item["material_code"].lower() and material_code.lower() not in item["description"].lower():
            continue
        if tx_type and tx_type != item["tx_type"]:
            continue
        item_date_str = item["date"]
        if item_date_str:
            if start_date and item_date_str < start_date:
                continue
            if end_date and item_date_str > end_date:
                continue
        filtered_items.append(item)

    for item in filtered_items:
        if "timestamp" in item:
            del item["timestamp"]

    return filtered_items
