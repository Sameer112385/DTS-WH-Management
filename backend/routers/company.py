from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models import Plant, StorageLocation, Warehouse, Project, WbsElement, Department, CostCenter, User, AuditTrail, Stock, MRF, MRFLineItem
from backend.schemas import (
    PlantCreate, PlantResponse, 
    StorageLocationCreate, StorageLocationResponse,
    WarehouseCreate, WarehouseResponse,
    ProjectCreate, ProjectResponse,
    WbsElementCreate, WbsElementResponse,
    DepartmentCreate, DepartmentResponse,
    CostCenterCreate, CostCenterResponse
)
from backend.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/company", tags=["company"])

# --- PLANTS ---
@router.get("/plants", response_model=List[PlantResponse])
def get_plants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Plant).all()

@router.post("/plants", response_model=PlantResponse)
def create_plant(
    plant_in: PlantCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    db_plant = db.query(Plant).filter(Plant.code == plant_in.code).first()
    if db_plant:
        raise HTTPException(status_code=400, detail="Plant code already exists")
    plant = Plant(**plant_in.dict())
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant

# --- STORAGE LOCATIONS ---
@router.get("/storage-locations", response_model=List[StorageLocationResponse])
def get_storage_locations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(StorageLocation).all()

@router.post("/storage-locations", response_model=StorageLocationResponse)
def create_storage_location(
    loc_in: StorageLocationCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    # Check if plant exists
    plant = db.query(Plant).filter(Plant.code == loc_in.plant_code).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    db_loc = db.query(StorageLocation).filter(
        StorageLocation.code == loc_in.code, 
        StorageLocation.plant_code == loc_in.plant_code
    ).first()
    if db_loc:
        raise HTTPException(status_code=400, detail="Storage location code already exists for this plant")
        
    loc = StorageLocation(**loc_in.dict())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

# --- WAREHOUSES ---
@router.get("/warehouses", response_model=List[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Warehouse).all()

@router.post("/warehouses", response_model=WarehouseResponse)
def create_warehouse(
    wh_in: WarehouseCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    wh = Warehouse(**wh_in.dict())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh

# --- PROJECTS ---
@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Project).all()

@router.post("/projects", response_model=ProjectResponse)
def create_project(
    proj_in: ProjectCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    db_proj = db.query(Project).filter(Project.code == proj_in.code).first()
    if db_proj:
        raise HTTPException(status_code=400, detail="Project code already exists")
    proj = Project(**proj_in.dict())
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

# --- WBS ELEMENTS ---
@router.get("/wbs-elements", response_model=List[WbsElementResponse])
def get_wbs_elements(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(WbsElement).all()

@router.post("/wbs-elements", response_model=WbsElementResponse)
def create_wbs_element(
    wbs_in: WbsElementCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    # Check if project exists
    proj = db.query(Project).filter(Project.code == wbs_in.project_code).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    db_wbs = db.query(WbsElement).filter(WbsElement.code == wbs_in.code).first()
    if db_wbs:
        raise HTTPException(status_code=400, detail="WBS Element code already exists")
        
    wbs = WbsElement(**wbs_in.dict())
    db.add(wbs)
    db.commit()
    db.refresh(wbs)
    return wbs

# --- DEPARTMENTS ---
@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Department).all()

@router.post("/departments", response_model=DepartmentResponse)
def create_department(
    dept_in: DepartmentCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    dept = Department(**dept_in.dict())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

# --- COST CENTERS ---
@router.get("/cost-centers", response_model=List[CostCenterResponse])
def get_cost_centers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(CostCenter).all()

@router.post("/cost-centers", response_model=CostCenterResponse)
def create_cost_center(
    cc_in: CostCenterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    existing = db.query(CostCenter).filter(CostCenter.code == cc_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cost center code already exists")
    cc = CostCenter(**cc_in.dict())
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return cc

# --- PUT / DELETE PLANTS ---
@router.put("/plants/{code}", response_model=PlantResponse)
def update_plant(
    code: str,
    plant_in: PlantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    plant = db.query(Plant).filter(Plant.code == code).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    plant.name = plant_in.name
    plant.location = plant_in.location
    db.commit()
    db.refresh(plant)
    return plant

@router.delete("/plants/{code}")
def delete_plant(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    plant = db.query(Plant).filter(Plant.code == code).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    locs = db.query(StorageLocation).filter(StorageLocation.plant_code == code).count()
    if locs > 0:
        raise HTTPException(status_code=400, detail="Cannot delete plant because it has active storage locations linked to it.")
    stock_count = db.query(Stock).filter(
        Stock.plant_code == code
    ).filter(
        (Stock.available_qty > 0) |
        (Stock.blocked_qty > 0) |
        (Stock.quality_inspection_qty > 0) |
        (Stock.transit_qty > 0)
    ).count()
    if stock_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete plant because it has active stock records associated with it.")
    db.delete(plant)
    db.commit()
    return {"message": "Plant deleted successfully"}

# --- PUT / DELETE STORAGE LOCATIONS ---
@router.put("/storage-locations/{plant_code}/{code}", response_model=StorageLocationResponse)
def update_storage_location(
    plant_code: str,
    code: str,
    loc_in: StorageLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    loc = db.query(StorageLocation).filter(
        StorageLocation.code == code,
        StorageLocation.plant_code == plant_code
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found")
    loc.name = loc_in.name
    db.commit()
    db.refresh(loc)
    return loc

@router.delete("/storage-locations/{plant_code}/{code}")
def delete_storage_location(
    plant_code: str,
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    loc = db.query(StorageLocation).filter(
        StorageLocation.code == code,
        StorageLocation.plant_code == plant_code
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found")
    stock_count = db.query(Stock).filter(
        Stock.plant_code == plant_code,
        Stock.storage_location_code == code
    ).filter(
        (Stock.available_qty > 0) |
        (Stock.blocked_qty > 0) |
        (Stock.quality_inspection_qty > 0) |
        (Stock.transit_qty > 0)
    ).count()
    if stock_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete storage location because it has active stock records associated with it.")
    db.delete(loc)
    db.commit()
    return {"message": "Storage location deleted successfully"}

# --- PUT / DELETE WAREHOUSES ---
@router.put("/warehouses/{id}", response_model=WarehouseResponse)
def update_warehouse(
    id: int,
    wh_in: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    wh = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    wh.name = wh_in.name
    wh.location = wh_in.location
    wh.description = wh_in.description
    db.commit()
    db.refresh(wh)
    return wh

@router.delete("/warehouses/{id}")
def delete_warehouse(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    wh = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    mrf_count = db.query(MRF).filter(MRF.requested_from_warehouse_id == id).count()
    if mrf_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete warehouse because it is linked to existing MRFs.")
    db.delete(wh)
    db.commit()
    return {"message": "Warehouse deleted successfully"}

# --- PUT / DELETE PROJECTS ---
@router.put("/projects/{code}", response_model=ProjectResponse)
def update_project(
    code: str,
    proj_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    proj = db.query(Project).filter(Project.code == code).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    proj.name = proj_in.name
    proj.description = proj_in.description
    db.commit()
    db.refresh(proj)
    return proj

@router.delete("/projects/{code}")
def delete_project(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    proj = db.query(Project).filter(Project.code == code).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    wbs_count = db.query(WbsElement).filter(WbsElement.project_code == code).count()
    if wbs_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete project because it has active WBS elements linked to it.")
    mrf_count = db.query(MRF).filter(MRF.project_code == code).count()
    if mrf_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete project because it is referenced in existing MRFs.")
    db.delete(proj)
    db.commit()
    return {"message": "Project deleted successfully"}

# --- PUT / DELETE WBS ELEMENTS ---
@router.put("/wbs-elements/{code}", response_model=WbsElementResponse)
def update_wbs_element(
    code: str,
    wbs_in: WbsElementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    wbs = db.query(WbsElement).filter(WbsElement.code == code).first()
    if not wbs:
        raise HTTPException(status_code=404, detail="WBS Element not found")
    wbs.description = wbs_in.description
    wbs.project_code = wbs_in.project_code
    db.commit()
    db.refresh(wbs)
    return wbs

@router.delete("/wbs-elements/{code}")
def delete_wbs_element(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    wbs = db.query(WbsElement).filter(WbsElement.code == code).first()
    if not wbs:
        raise HTTPException(status_code=404, detail="WBS Element not found")
    stock_count = db.query(Stock).filter(
        Stock.wbs_code == code
    ).filter(
        (Stock.available_qty > 0) |
        (Stock.blocked_qty > 0) |
        (Stock.quality_inspection_qty > 0) |
        (Stock.transit_qty > 0)
    ).count()
    if stock_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete WBS element because it has active stock records associated with it.")
    mrf_count = db.query(MRFLineItem).filter(MRFLineItem.wbs_code == code).count()
    if mrf_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete WBS element because it is referenced in existing MRF line items.")
    db.delete(wbs)
    db.commit()
    return {"message": "WBS Element deleted successfully"}

# --- PUT / DELETE DEPARTMENTS ---
@router.put("/departments/{id}", response_model=DepartmentResponse)
def update_department(
    id: int,
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name = dept_in.name
    dept.description = dept_in.description
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/departments/{id}")
def delete_department(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    mrf_count = db.query(MRF).filter(MRF.department_id == id).count()
    if mrf_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete department because it is referenced in existing MRFs.")
    db.delete(dept)
    db.commit()
    return {"message": "Department deleted successfully"}

# --- PUT / DELETE COST CENTERS ---
@router.put("/cost-centers/{code}", response_model=CostCenterResponse)
def update_cost_center(
    code: str,
    cc_in: CostCenterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    cc = db.query(CostCenter).filter(CostCenter.code == code).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")
    cc.name = cc_in.name
    cc.description = cc_in.description
    db.commit()
    db.refresh(cc)
    return cc

@router.delete("/cost-centers/{code}")
def delete_cost_center(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"]))
):
    cc = db.query(CostCenter).filter(CostCenter.code == code).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")
    mrf_count = db.query(MRF).filter(MRF.cost_center_code == code).count()
    if mrf_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete cost center because it is referenced in existing MRFs.")
    db.delete(cc)
    db.commit()
    return {"message": "Cost center deleted successfully"}
