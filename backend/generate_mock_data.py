import os
import sys
import pandas as pd
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import settings
from backend.database import Base
from backend.models import (
    User, Plant, StorageLocation, Warehouse, Project, 
    WbsElement, Department, CostCenter, Material, Stock, EmailSetting,
    MRF, MRFLineItem, MaterialReceiving, MaterialReceivingLineItem,
    AuditTrail
)
from backend.auth import get_password_hash

# Define required MB52 columns
MB52_COLUMNS = [
    "Material", "Plant", "Storage Location", "Special Stock", "Spec. stk valuation",
    "Special stock number", "DF stor. loc. level", "Base Unit of Measure", "Unrestricted",
    "Stock Segment", "Currency", "Value Unrestricted", "Transit and Transfer",
    "Val. in Trans./Tfr", "Quality Inspection", "Value in QualInsp.", "Restricted-Use Stock",
    "Value Restricted", "Blocked", "Value BlockedStock", "Returns", "Value Rets Blocked",
    "Material Description", "Name 1", "Material Type", "Material Group",
    "Descr. of Storage Loc.", "Valuated Goods Receipt Blocked Stock", "Val. GR Blocked St.",
    "Tied Empties", "Val. Tied Empties", "Stock in Transit", "Value in Transit",
    "In transfer (plant)", "Value in Stock Tfr", "Customer", "WBS Element"
]

def generate_mock_db():
    print(f"Creating database engine at: {settings.DATABASE_URL}")
    db_file_path = settings.DATABASE_URL.replace("sqlite:///", "")
    os.makedirs(os.path.dirname(db_file_path), exist_ok=True)
    
    # Initialize engine
    engine = create_engine(settings.DATABASE_URL)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        print("Populating default users...")
        users = [
            User(username="admin", name="System Administrator", email="admin@company.com", mobile="+966550000001", role="Admin", hashed_password=get_password_hash("admin123")),
            User(username="manager", name="Warehouse Manager", email="manager@company.com", mobile="+966550000002", role="Warehouse Manager", hashed_password=get_password_hash("manager123")),
            User(username="supervisor", name="Warehouse Supervisor", email="supervisor@company.com", mobile="+966550000003", role="Warehouse Supervisor", hashed_password=get_password_hash("supervisor123")),
            User(username="worker", name="Warehouse Worker", email="worker@company.com", mobile="+966550000004", role="Warehouse Worker", hashed_password=get_password_hash("worker123")),
            User(username="requestor", name="Materials Requestor", email="requestor@company.com", mobile="+966550000005", role="Requestor", hashed_password=get_password_hash("requestor123")),
            User(username="requestormanager", name="Requestor Manager", email="reqmanager@company.com", mobile="+966550000006", role="Requestor Manager", hashed_password=get_password_hash("requestormanager123")),
        ]
        db.add_all(users)
        db.commit()

        print("Populating default Plants, Storage Locations, Warehouses...")
        plants = [
            Plant(code="PL01", name="Riyadh Central Plant", location="Industrial Area, Riyadh"),
            Plant(code="PL02", name="Jeddah Hub Plant", location="Jeddah Port Area")
        ]
        db.add_all(plants)
        db.commit()

        locs = [
            StorageLocation(code="SL01", plant_code="PL01", name="Main Warehouse Bin"),
            StorageLocation(code="SL02", plant_code="PL01", name="Blocked Materials Rack"),
            StorageLocation(code="SL03", plant_code="PL02", name="Transit Stage Area")
        ]
        db.add_all(locs)
        db.commit()

        warehouses = [
            Warehouse(name="Central Warehouse A", location="Riyadh PL01 Site", description="Main parts and heavy structures storage"),
            Warehouse(name="Jeddah Logistics Depo", location="Jeddah PL02 Site", description="Port imports buffer warehouse")
        ]
        db.add_all(warehouses)
        db.commit()

        print("Populating default Projects, WBS Elements, Departments...")
        projects = [
            Project(code="PRJ-METRO", name="Riyadh Metro Extension", description="Riyadh metro lines 3 and 4 expansions"),
            Project(code="PRJ-NEOM", name="NEOM Line Site Setup", description="Structural foundations setup for NEOM linear corridor")
        ]
        db.add_all(projects)
        db.commit()

        wbs = [
            WbsElement(code="WBS-MET-01.01", project_code="PRJ-METRO", description="Civil concrete works foundation"),
            WbsElement(code="WBS-MET-02.04", project_code="PRJ-METRO", description="Electrical cables grid installation"),
            WbsElement(code="WBS-NEO-50.12", project_code="PRJ-NEOM", description="Steel girders assembly phase 1")
        ]
        db.add_all(wbs)
        db.commit()

        depts = [
            Department(name="Civil Engineering", description="Site foundation & concrete"),
            Department(name="Electrical Works", description="Cable laying & distribution grids"),
            Department(name="Logistics and Supply Chain", description="Material movements & fleet coordination")
        ]
        db.add_all(depts)
        db.commit()

        cost_centers = [
            CostCenter(code="CC-OPS-001", name="Operations Consumables", description="Yard and warehouse operating supplies"),
            CostCenter(code="CC-MNT-002", name="Maintenance Works", description="Repairs and internal maintenance activities")
        ]
        db.add_all(cost_centers)
        db.commit()

        print("Populating Material Master and stock ledger...")
        materials = [
            Material(material_code="1000491", description="High-Tensile Steel Girder 12m", uom="PCS", material_type="ROH", material_group="STEEL"),
            Material(material_code="1000520", description="Armored Copper Cable 4x120mm", uom="MTR", material_type="HALB", material_group="CABLE"),
            Material(material_code="1000603", description="Portland Cement Grade II", uom="BAG", material_type="ROH", material_group="CONCRETE"),
            Material(material_code="1000781", description="Submersible Water Pump 15HP", uom="EA", material_type="FERT", material_group="PUMPS")
        ]
        db.add_all(materials)
        db.commit()

        stock = [
            Stock(material_code="1000491", plant_code="PL01", storage_location_code="SL01", wbs_code="WBS-MET-01.01", available_qty=150.0, blocked_qty=0.0, quality_inspection_qty=0.0, transit_qty=0.0, stock_value=45000.0),
            Stock(material_code="1000520", plant_code="PL01", storage_location_code="SL01", wbs_code="WBS-MET-02.04", available_qty=1200.0, blocked_qty=0.0, quality_inspection_qty=0.0, transit_qty=150.0, stock_value=24000.0),
            Stock(material_code="1000603", plant_code="PL01", storage_location_code="SL02", wbs_code=None, available_qty=450.0, blocked_qty=50.0, quality_inspection_qty=0.0, transit_qty=0.0, stock_value=2250.0),
            # Zero stock item for low stock indicator testing
            Stock(material_code="1000781", plant_code="PL02", storage_location_code="SL03", wbs_code="WBS-NEO-50.12", available_qty=3.0, blocked_qty=0.0, quality_inspection_qty=2.0, transit_qty=0.0, stock_value=9000.0),
        ]
        db.add_all(stock)
        db.commit()

        # Create Default Settings
        email_set = EmailSetting(id=1, ssl_tls=True, email_approval_enabled=False)
        db.add(email_set)
        db.commit()

        # Add Audit log
        audit = AuditTrail(
            username="System Init",
            action="Database Configured",
            remarks="System database tables successfully generated and seeded with default operational records."
        )
        db.add(audit)
        db.commit()
        
        print("Mock database generation succeeded!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding mock database: {str(e)}")
        raise e
    finally:
        db.close()


def generate_mock_excel():
    excel_path = "C:/Users/dts7435/.gemini/antigravity/scratch/warehouse_app/backend/MB52_Report.xlsx"
    print(f"Generating SAP MB52 report template at: {excel_path}")
    
    # Let's write columns with some records matching our seeded DB, but with some variations
    # to trigger discrepancy alerts
    data = []
    
    # Record 1: Steel Girder 1000491 in PL01 SL01 WBS-MET-01.01. (Seeded: 150.0. Excel: 140.0 -> Discrepancy of -10)
    row1 = {col: "" for col in MB52_COLUMNS}
    row1["Material"] = "1000491"
    row1["Plant"] = "PL01"
    row1["Storage Location"] = "SL01"
    row1["Base Unit of Measure"] = "PCS"
    row1["Unrestricted"] = 140.0
    row1["Value Unrestricted"] = 42000.0
    row1["Material Description"] = "High-Tensile Steel Girder 12m"
    row1["Material Type"] = "ROH"
    row1["Material Group"] = "STEEL"
    row1["WBS Element"] = "WBS-MET-01.01"
    data.append(row1)

    # Record 2: Copper Cable 1000520 in PL01 SL01 WBS-MET-02.04. (Seeded: 1200.0. Excel: 1200.0 -> Perfect match)
    row2 = {col: "" for col in MB52_COLUMNS}
    row2["Material"] = "1000520"
    row2["Plant"] = "PL01"
    row2["Storage Location"] = "SL01"
    row2["Base Unit of Measure"] = "MTR"
    row2["Unrestricted"] = 1200.0
    row2["Value Unrestricted"] = 24000.0
    row2["Transit and Transfer"] = 150.0
    row2["Material Description"] = "Armored Copper Cable 4x120mm"
    row2["Material Type"] = "HALB"
    row2["Material Group"] = "CABLE"
    row2["WBS Element"] = "WBS-MET-02.04"
    data.append(row2)

    # Record 3: Cement 1000603 in PL01 SL02. (Seeded: 450.0. Excel: 480.0 -> Discrepancy of +30)
    row3 = {col: "" for col in MB52_COLUMNS}
    row3["Material"] = "1000603"
    row3["Plant"] = "PL01"
    row3["Storage Location"] = "SL02"
    row3["Base Unit of Measure"] = "BAG"
    row3["Unrestricted"] = 480.0
    row3["Blocked"] = 50.0
    row3["Value Unrestricted"] = 2400.0
    row3["Material Description"] = "Portland Cement Grade II"
    row3["Material Type"] = "ROH"
    row3["Material Group"] = "CONCRETE"
    data.append(row3)

    df = pd.DataFrame(data, columns=MB52_COLUMNS)
    df.to_excel(excel_path, index=False)
    print("Excel template generation succeeded!")

if __name__ == "__main__":
    generate_mock_db()
    generate_mock_excel()
