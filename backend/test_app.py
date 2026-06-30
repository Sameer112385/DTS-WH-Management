import unittest
import os
import sys
import tempfile
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base
from backend.models import (
    User, Plant, StorageLocation, Warehouse, Project, WbsElement, Department,
    CostCenter, Material, Stock, MB52UploadHistory, Discrepancy, MRF, MRFLineItem,
    MaterialReceiving, MaterialReceivingLineItem, MaterialTransfer, MaterialTransferLineItem,
    Cancellation, AuditTrail, EmailSetting, Attachment, StockIssueMovement, MRFActionLog
)
from backend.utils.excel_parser import parse_mb52_excel, REQUIRED_COLUMNS
from backend.utils.pdf_generator import generate_mrf_pdf, generate_receiving_pdf, generate_transfer_pdf

class TestWarehouseApp(unittest.TestCase):
    def setUp(self):
        # Setup clean test memory database
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

        # Seed minimal materials
        m = Material(material_code="MAT001", description="Test Material", uom="EA")
        self.db.add(m)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_database_models_stock_ingestion(self):
        # Create a stock item
        s = Stock(
            material_code="MAT001",
            plant_code="PL01",
            storage_location_code="SL01",
            available_qty=100.0,
            stock_value=1000.0
        )
        self.db.add(s)
        self.db.commit()

        # Query and assert
        queried = self.db.query(Stock).filter(Stock.material_code == "MAT001").first()
        self.assertIsNotNone(queried)
        self.assertEqual(queried.available_qty, 100.0)
        self.assertEqual(queried.stock_value, 1000.0)

    def test_excel_parser_with_bad_columns(self):
        # Create invalid excel sheet
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            df = pd.DataFrame([{"BadColumn": "Value"}])
            df.to_excel(tmp_path, index=False)
            
            success, msg, records = parse_mb52_excel(tmp_path)
            self.assertFalse(success)
            self.assertIn("Missing required columns", msg)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_excel_parser_validation(self):
        # Create valid excel sheet layout
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
            tmp_path = tmp.name
            
        try:
            row = {col: "" for col in REQUIRED_COLUMNS}
            row["Material"] = "MAT001"
            row["Plant"] = "PL01"
            row["Storage Location"] = "SL01"
            row["Base Unit of Measure"] = "EA"
            row["Unrestricted"] = 80.0
            row["Value Unrestricted"] = 800.0
            row["Material Description"] = "Test Material"
            row["WBS Element"] = "WBS-TEST"

            df = pd.DataFrame([row], columns=REQUIRED_COLUMNS)
            df.to_excel(tmp_path, index=False)
            
            success, msg, records = parse_mb52_excel(tmp_path)
            self.assertTrue(success)
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]["material_code"], "MAT001")
            self.assertEqual(records[0]["available_qty"], 80.0)
            self.assertEqual(records[0]["wbs"], "WBS-TEST")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_pdf_generation(self):
        # Ensure pdf_generator writes files correctly
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            mrf_data = {
                "reference_number": "MRF-TEST-0001",
                "date": "2026-06-10",
                "requested_by_name": "Test User",
                "department_name": "Engineering",
                "project_name": "Test Project",
                "line_items": [
                    {
                        "material_code": "MAT001",
                        "description": "Test Material",
                        "uom": "EA",
                        "requested_qty": 5.0,
                        "approved_qty": 5.0,
                        "issued_qty": 0.0,
                        "wbs_code": "WBS-1"
                    }
                ]
            }
            generate_mrf_pdf(mrf_data, tmp_path, cancelled=False)
            self.assertTrue(os.path.exists(tmp_path))
            self.assertTrue(os.path.getsize(tmp_path) > 0)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

from fastapi import Depends
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db
from backend.auth import get_current_user
from backend.models import User, Plant, StorageLocation, Warehouse, Project, WbsElement, Department, CostCenter, Material, Stock, MRF, MRFLineItem, CompanySetting, StockIssueMovement
from backend.routers.mrf import create_email_action_token

from sqlalchemy.pool import StaticPool

class TestWarehouseAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Override database to SQLite in-memory using StaticPool
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        Base.metadata.create_all(bind=cls.engine)
        cls.TestingSessionLocal = sessionmaker(bind=cls.engine)
        
        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()
                
        app.dependency_overrides[get_db] = override_get_db
        
        # Mock admin user
        admin_user = User(
            id=1,
            username="admin_test",
            hashed_password="hashed_password",
            name="Admin Test",
            email="admin@test.com",
            role="Admin",
            is_active=True
        )
        db = cls.TestingSessionLocal()
        db.add(admin_user)
        db.commit()
        db.close()
        
        def override_get_current_user(db: Session = Depends(override_get_db)):
            return db.query(User).filter(User.id == 1).first()
            
        app.dependency_overrides[get_current_user] = override_get_current_user
        cls.client = TestClient(app)

    def setUp(self):
        self.db = self.TestingSessionLocal()

    def tearDown(self):
        self.db.query(Stock).delete()
        self.db.query(Material).delete()
        self.db.query(StockIssueMovement).delete()
        self.db.query(MRFActionLog).delete()
        self.db.query(MRFLineItem).delete()
        self.db.query(MRF).delete()
        self.db.query(Plant).delete()
        self.db.query(StorageLocation).delete()
        self.db.query(Warehouse).delete()
        self.db.query(Project).delete()
        self.db.query(WbsElement).delete()
        self.db.query(Department).delete()
        self.db.query(CostCenter).delete()
        self.db.query(User).filter(User.id != 1).delete()
        self.db.query(CompanySetting).delete()
        self.db.commit()
        self.db.close()

    def test_user_update_and_delete(self):
        target_user = User(
            username="target_user",
            hashed_password="hashed_password",
            name="Target User",
            email="target@test.com",
            role="Warehouse Worker",
            is_active=True
        )
        self.db.add(target_user)
        self.db.commit()
        self.db.refresh(target_user)
        
        payload = {
            "name": "Target User Updated",
            "email": "target_updated@test.com",
            "mobile": "123456789",
            "role": "Warehouse Manager",
            "is_active": False,
            "password": "newpassword123"
        }
        res = self.client.put(f"/api/v1/auth/users/{target_user.id}", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["name"], "Target User Updated")
        self.assertEqual(data["email"], "target_updated@test.com")
        self.assertEqual(data["role"], "Warehouse Manager")
        self.assertFalse(data["is_active"])
        
        res = self.client.delete(f"/api/v1/auth/users/{target_user.id}")
        self.assertEqual(res.status_code, 200)
        
        db_user = self.db.query(User).filter(User.id == target_user.id).first()
        self.assertIsNone(db_user)

    def test_user_update_allows_duplicate_email(self):
        first_user = User(
            username="first_user",
            hashed_password="hashed_password",
            name="First User",
            email="shared@test.com",
            role="Warehouse Worker",
            is_active=True
        )
        second_user = User(
            username="second_user",
            hashed_password="hashed_password",
            name="Second User",
            email="second@test.com",
            role="Warehouse Worker",
            is_active=True
        )
        self.db.add_all([first_user, second_user])
        self.db.commit()
        self.db.refresh(second_user)

        res = self.client.put(f"/api/v1/auth/users/{second_user.id}", json={
            "name": "Second User",
            "email": "shared@test.com",
            "mobile": None,
            "role": "Warehouse Worker",
            "is_active": True,
            "password": None
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["email"], "shared@test.com")

    def test_user_delete_self_blocked(self):
        res = self.client.delete("/api/v1/auth/users/1")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Cannot delete your own user account", res.json()["detail"])

    def test_delete_plant_with_storage_locations_blocked(self):
        plant = Plant(code="PL01", name="Plant 01")
        self.db.add(plant)
        self.db.commit()
        
        loc = StorageLocation(code="SL01", plant_code="PL01", name="Loc 01")
        self.db.add(loc)
        self.db.commit()
        
        res = self.client.delete("/api/v1/company/plants/PL01")
        self.assertEqual(res.status_code, 400)
        self.assertIn("storage locations linked", res.json()["detail"])
        
        res = self.client.delete("/api/v1/company/storage-locations/PL01/SL01")
        self.assertEqual(res.status_code, 200)
        
        res = self.client.delete("/api/v1/company/plants/PL01")
        self.assertEqual(res.status_code, 200)

    def test_delete_project_with_wbs_blocked(self):
        project = Project(code="PRJ01", name="Project 01")
        self.db.add(project)
        self.db.commit()
        
        wbs = WbsElement(code="WBS01", project_code="PRJ01", description="WBS 01")
        self.db.add(wbs)
        self.db.commit()
        
        res = self.client.delete("/api/v1/company/projects/PRJ01")
        self.assertEqual(res.status_code, 400)
        self.assertIn("WBS elements linked", res.json()["detail"])
        
        res = self.client.delete("/api/v1/company/wbs-elements/WBS01")
        self.assertEqual(res.status_code, 200)
        
        res = self.client.delete("/api/v1/company/projects/PRJ01")
        self.assertEqual(res.status_code, 200)

    def test_company_branding_and_direct_issuance(self):
        # 1. Test GET /settings/company (should initialize default settings)
        res = self.client.get("/api/v1/settings/company")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["company_name"], "WAREHOUSE")
        self.assertEqual(data["currency"], "USD")
        
        # 2. Test POST /settings/company (update settings)
        payload = {
            "company_name": "Saudi Steel Corp",
            "company_logo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "address": "Riyadh Industrial City",
            "plant": "PL01",
            "currency": "SAR",
            "location": "Riyadh",
            "calendar": "Gulf Workweek (Sun-Thu)"
        }
        res = self.client.post("/api/v1/settings/company", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["company_name"], "Saudi Steel Corp")
        self.assertEqual(data["currency"], "SAR")
        self.assertEqual(data["calendar"], "Gulf Workweek (Sun-Thu)")
        
        # 3. Seed material and stock to test direct issuance
        material = Material(material_code="MAT999", description="Cement Grade II", uom="BAG")
        self.db.add(material)
        self.db.commit()
        
        stock = Stock(
            material_code="MAT999",
            plant_code="PL01",
            storage_location_code="SL01",
            available_qty=50.0,
            stock_value=500.0,
            wbs_code="WBS999"
        )
        self.db.add(stock)
        
        project = Project(code="PRJ999", name="Project Test")
        self.db.add(project)
        
        dept = Department(name="Logistics")
        self.db.add(dept)
        self.db.commit()
        
        # 4. Test direct issue
        issue_payload = {
            "material_code": "MAT999",
            "plant_code": "PL01",
            "storage_location_code": "SL01",
            "wbs_code": "WBS999",
            "quantity": 10.0,
            "requested_by_name": "Ahmad Al-Harbi",
            "department_id": dept.id,
            "project_code": "PRJ999",
            "purpose": "Site foundation",
            "vehicle_number": "B-X-9884",
            "vehicle_type": "Flatbed Truck",
            "driver_name": "Sameer",
            "driver_mobile": "998998989",
            "driver_iqama": "2441998471",
            "transport_company": "Al-Majd",
            "receiver_name": "Sameer",
            "receiver_mobile": "998998989",
            "delivery_location": "Riyadh Site",
            "remarks": "Urgent construction need",
            "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
        
        res = self.client.post("/api/v1/mrf/direct-issue", json=issue_payload)
        self.assertEqual(res.status_code, 200)
        mrf_data = res.json()
        self.assertEqual(mrf_data["status"], "Issued")
        self.assertEqual(mrf_data["total_qty"], 10.0)
        self.assertTrue(mrf_data["reference_number"].startswith("DIR-"))
        
        # Check stock deduction
        db_stock = self.db.query(Stock).filter(Stock.material_code == "MAT999").first()
        self.assertEqual(db_stock.available_qty, 40.0)
        self.assertEqual(db_stock.stock_value, 400.0)
        
        # 5. Test GET /materials/{code}/transactions
        res = self.client.get("/api/v1/materials/MAT999/transactions")
        self.assertEqual(res.status_code, 200)
        txs = res.json()
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0]["type"], "Issuance")
        self.assertEqual(txs[0]["reference"], mrf_data["reference_number"])
        self.assertEqual(txs[0]["quantity"], -10.0)

    def test_direct_issue_to_cost_center_and_precise_cancellation(self):
        material = Material(material_code="MATCC1", description="Workshop Gloves", uom="BOX")
        self.db.add(material)
        self.db.add(CostCenter(code="CC100", name="Maintenance", description="Maintenance works"))
        self.db.commit()

        source_stock = Stock(
            material_code="MATCC1",
            plant_code="PL99",
            storage_location_code="SL88",
            available_qty=20.0,
            stock_value=200.0
        )
        self.db.add(source_stock)
        dept = Department(name="Maintenance")
        self.db.add(dept)
        self.db.commit()

        issue_payload = {
            "material_code": "MATCC1",
            "plant_code": "PL99",
            "storage_location_code": "SL88",
            "quantity": 5.0,
            "requested_by_name": "Storekeeper",
            "department_id": dept.id,
            "issue_account_type": "cost_center",
            "cost_center_code": "CC100",
            "purpose": "Workshop usage",
            "vehicle_number": "XYZ-123",
            "vehicle_type": "Van",
            "driver_name": "Driver One",
            "driver_mobile": "555",
            "driver_iqama": "12345",
            "transport_company": "Internal",
            "receiver_name": "Receiver One",
            "receiver_mobile": "666",
            "delivery_location": "Workshop",
            "signature": "signed"
        }

        issue_res = self.client.post("/api/v1/mrf/direct-issue", json=issue_payload)
        self.assertEqual(issue_res.status_code, 200)
        issued = issue_res.json()
        self.assertEqual(issued["issue_account_type"], "cost_center")
        self.assertEqual(issued["cost_center_code"], "CC100")

        refreshed_stock = self.db.query(Stock).filter(Stock.id == source_stock.id).first()
        self.assertEqual(refreshed_stock.available_qty, 15.0)
        self.assertEqual(refreshed_stock.stock_value, 150.0)

        movements = self.db.query(StockIssueMovement).filter(StockIssueMovement.mrf_id == issued["id"]).all()
        self.assertEqual(len(movements), 1)
        self.assertEqual(movements[0].plant_code, "PL99")
        self.assertEqual(movements[0].storage_location_code, "SL88")

        cancel_res = self.client.post("/api/v1/reports/cancel", json={
            "transaction_type": "MRF",
            "transaction_id": issued["id"],
            "reason": "Issued by mistake"
        })
        self.assertEqual(cancel_res.status_code, 200)

        self.db.expire_all()
        restored_stock = self.db.query(Stock).filter(Stock.id == source_stock.id).first()
        self.assertEqual(restored_stock.available_qty, 20.0)
        self.assertEqual(restored_stock.stock_value, 200.0)

    def test_mrf_project_manager_contact_and_three_step_approval_flow(self):
        self.db.add(Project(code="PRJFLOW", name="Flow Project"))
        dept = Department(name="Projects")
        wh = Warehouse(name="Main Warehouse")
        material = Material(material_code="FLOW1", description="Cable", uom="M")
        stock = Stock(
            material_code="FLOW1",
            plant_code="PL01",
            storage_location_code="SL01",
            available_qty=25.0,
            stock_value=250.0,
            wbs_code="WBS-FLOW"
        )
        self.db.add_all([dept, wh, material, stock])
        self.db.commit()

        create_res = self.client.post("/api/v1/mrf/", json={
            "date": "2026-06-11",
            "requested_by_name": "Ahmed",
            "staff_mobile": "+966500000001",
            "department_id": dept.id,
            "project_code": "PRJFLOW",
            "issue_account_type": "project",
            "requestor_manager_name": "Req Manager",
            "requestor_manager_email": "req.manager@example.com",
            "project_manager_name": "Project Lead",
            "project_manager_email": "lead@example.com",
            "requested_from_warehouse_id": wh.id,
            "purpose": "Site work",
            "wbs_code": "WBS-FLOW",
            "line_items": [
                {
                    "sn": 1,
                    "material_code": "FLOW1",
                    "description": "Cable",
                    "uom": "M",
                    "requested_qty": 5.0,
                    "wbs_code": "WBS-FLOW"
                }
            ],
            "requestor_signature": "signed"
        })
        self.assertEqual(create_res.status_code, 200)
        created = create_res.json()
        self.assertEqual(created["status"], "Pending Requestor Manager Approval")
        self.assertEqual(created["project_manager_name"], "Project Lead")
        self.assertEqual(created["project_manager_email"], "lead@example.com")

        mrf_id = created["id"]
        line_id = created["line_items"][0]["id"]

        step1 = self.client.post(f"/api/v1/mrf/{mrf_id}/approve", json={
            "approver_name": "Req Manager",
            "signature": "signed"
        })
        self.assertEqual(step1.status_code, 200)
        self.assertEqual(step1.json()["status"], "Pending Warehouse Supervisor Check")

        step2 = self.client.post(f"/api/v1/mrf/{mrf_id}/approve", json={
            "approver_name": "Supervisor",
            "signature": "signed",
            "approved_quantities": {str(line_id): 5}
        })
        self.assertEqual(step2.status_code, 200)
        self.assertEqual(step2.json()["status"], "Pending Warehouse Manager Approval")

        step3 = self.client.post(f"/api/v1/mrf/{mrf_id}/approve", json={
            "approver_name": "Manager",
            "signature": "signed"
        })
        self.assertEqual(step3.status_code, 200)
        self.assertEqual(step3.json()["status"], "Ready to Issue")

    def test_mrf_send_back_and_resubmit_workflow(self):
        self.db.add(Project(code="PRJSB", name="Send Back Project"))
        dept = Department(name="Projects")
        wh = Warehouse(name="Main Warehouse")
        material = Material(material_code="SB1", description="Valve", uom="EA")
        self.db.add_all([dept, wh, material])
        self.db.commit()

        create_res = self.client.post("/api/v1/mrf/", json={
            "date": "2026-06-11",
            "requested_by_name": "Requester User",
            "staff_mobile": "+966500000009",
            "department_id": dept.id,
            "project_code": "PRJSB",
            "issue_account_type": "project",
            "requestor_manager_name": "RM User",
            "requestor_manager_email": "rm@example.com",
            "project_manager_name": "PM User",
            "project_manager_email": "pm@example.com",
            "requested_from_warehouse_id": wh.id,
            "purpose": "Testing workflow",
            "line_items": [
                {
                    "sn": 1,
                    "material_code": "SB1",
                    "description": "Valve",
                    "uom": "EA",
                    "requested_qty": 2.0
                }
            ],
            "requestor_signature": "signed"
        })
        self.assertEqual(create_res.status_code, 200)
        mrf_id = create_res.json()["id"]

        send_back_res = self.client.post(f"/api/v1/mrf/{mrf_id}/approve", json={
            "action": "send_back",
            "approver_name": "RM User",
            "signature": "signed",
            "comments": "Need clearer purpose"
        })
        self.assertEqual(send_back_res.status_code, 200)
        sent_back = send_back_res.json()
        self.assertEqual(sent_back["status"], "Sent Back to Requestor")
        self.assertEqual(sent_back["last_action_comment"], "Need clearer purpose")

        db_mrf = self.db.query(MRF).filter(MRF.id == mrf_id).first()
        db_mrf.status = "Sent Back to Requestor"
        self.db.commit()

        resubmit_res = self.client.post(f"/api/v1/mrf/{mrf_id}/approve", json={
            "action": "resubmit",
            "approver_name": "Requester User",
            "comments": "Updated details and resubmitting"
        })
        self.assertEqual(resubmit_res.status_code, 200)
        self.assertEqual(resubmit_res.json()["status"], "Pending Requestor Manager Approval")

    def test_mrf_email_action_link_records_timeline_entry(self):
        self.db.add(Project(code="PRJMAIL", name="Email Flow Project"))
        dept = Department(name="Projects")
        wh = Warehouse(name="Main Warehouse")
        material = Material(material_code="MAIL1", description="Cable Tray", uom="EA")
        manager_user = User(
            username="manager_mail",
            hashed_password="hashed_password",
            name="Manager Mail",
            email="manager@example.com",
            role="Warehouse Manager",
            is_active=True
        )
        self.db.add_all([dept, wh, material, manager_user])
        self.db.commit()

        mrf = MRF(
            reference_number="MRF-EMAIL-0001",
            date="2026-06-11",
            requested_by_name="Requester User",
            department_id=dept.id,
            project_code="PRJMAIL",
            issue_account_type="project",
            requestor_manager_name="RM User",
            requestor_manager_email="rm@example.com",
            project_manager_name="PM User",
            project_manager_email="pm@example.com",
            requested_from_warehouse_id=wh.id,
            purpose="Email approval test",
            status="Pending Warehouse Manager Approval",
            supervisor_name="Supervisor User",
            supervisor_signature="signed"
        )
        self.db.add(mrf)
        self.db.commit()
        self.db.refresh(mrf)

        line = MRFLineItem(
            mrf_id=mrf.id,
            sn=1,
            material_code="MAIL1",
            description="Cable Tray",
            uom="EA",
            requested_qty=3.0,
            approved_qty=3.0,
            issued_qty=0.0
        )
        self.db.add(line)
        self.db.commit()
        self.db.refresh(mrf)

        token = create_email_action_token(mrf, manager_user.email, manager_user.role)

        page_res = self.client.get(f"/api/v1/mrf/email-action?token={token}&action=approve")
        self.assertEqual(page_res.status_code, 200)
        self.assertIn("MRF Email Action", page_res.text)
        self.assertIn(mrf.reference_number, page_res.text)

        submit_res = self.client.post("/api/v1/mrf/email-action/submit", data={
            "token": token,
            "action": "approve",
            "comments": "Approved from email"
        })
        self.assertEqual(submit_res.status_code, 200)
        self.assertIn("Action Recorded", submit_res.text)

        self.db.expire_all()
        updated = self.db.query(MRF).filter(MRF.id == mrf.id).first()
        self.assertEqual(updated.status, "Ready to Issue")
        self.assertEqual(updated.last_action_comment, "Approved from email")

        action_log = self.db.query(MRFActionLog).filter(MRFActionLog.mrf_id == mrf.id).order_by(MRFActionLog.id.desc()).first()
        self.assertIsNotNone(action_log)
        self.assertEqual(action_log.source, "email")
        self.assertEqual(action_log.action, "approve")
        self.assertEqual(action_log.comment, "Approved from email")

if __name__ == "__main__":
    unittest.main()
