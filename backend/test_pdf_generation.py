import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import MaterialReceiving, MRF, MaterialTransfer, Department, Warehouse, Project
from backend.utils.pdf_generator import generate_receiving_pdf, generate_mrf_pdf, generate_transfer_pdf
from backend.config import settings

def test_receiving_pdf():
    db = SessionLocal()
    try:
        rec = db.query(MaterialReceiving).filter(MaterialReceiving.id == 1).first()
        if not rec:
            print("No receiving record with ID 1")
            return
        
        pdf_filename = f"receiving_{rec.receiving_number}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
        
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
        print(f"Generating receiving PDF to {pdf_path}...")
        generate_receiving_pdf(rec_pdf_data, pdf_path, cancelled=(rec.status == "Cancelled"))
        print("Receiving PDF generated successfully!")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_mrf_pdf():
    db = SessionLocal()
    try:
        mrf = db.query(MRF).filter(MRF.id == 1).first()
        if not mrf:
            print("No MRF record with ID 1")
            return
        
        pdf_filename = f"mrf_{mrf.reference_number}.pdf"
        pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)
        
        dept_name = db.query(Department.name).filter(Department.id == mrf.department_id).scalar() or "N/A"
        wh_name = db.query(Warehouse.name).filter(Warehouse.id == mrf.requested_from_warehouse_id).scalar() or "N/A"
        proj_name = db.query(Project.name).filter(Project.code == mrf.project_code).scalar() or "N/A"
        
        mrf_pdf_data = {
            "reference_number": mrf.reference_number,
            "date": mrf.date,
            "requested_by_name": mrf.requested_by_name,
            "department_name": dept_name,
            "project_name": proj_name,
            "wbs_code": mrf.wbs_code or "N/A",
            "warehouse_name": wh_name,
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
            "project_manager_name": mrf.project_manager_name,
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
        print(f"Generating MRF PDF to {pdf_path}...")
        generate_mrf_pdf(mrf_pdf_data, pdf_path, cancelled=(mrf.status == "Cancelled"))
        print("MRF PDF generated successfully!")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("Testing Receiving PDF...")
    test_receiving_pdf()
    print("\nTesting MRF PDF...")
    test_mrf_pdf()
