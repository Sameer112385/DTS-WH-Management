from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

# Auth Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# User
class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    email: str
    mobile: Optional[str] = None
    role: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    email: str
    mobile: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: str
    email: str
    mobile: Optional[str] = None
    role: str
    is_active: bool
    password: Optional[str] = None

# Plant
class PlantCreate(BaseModel):
    code: str
    name: str
    location: Optional[str] = None

class PlantResponse(BaseModel):
    code: str
    name: str
    location: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# StorageLocation
class StorageLocationCreate(BaseModel):
    code: str
    plant_code: str
    name: str

class StorageLocationResponse(BaseModel):
    code: str
    plant_code: str
    name: str
    created_at: datetime
    class Config:
        from_attributes = True

# Warehouse
class WarehouseCreate(BaseModel):
    name: str
    location: Optional[str] = None
    description: Optional[str] = None

class WarehouseResponse(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Project
class ProjectCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# WBS Element
class WbsElementCreate(BaseModel):
    code: str
    project_code: str
    description: Optional[str] = None

class WbsElementResponse(BaseModel):
    code: str
    project_code: str
    description: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Department
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Cost Center
class CostCenterCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None

class CostCenterResponse(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Material
class MaterialCreate(BaseModel):
    material_code: str
    description: str
    uom: str
    material_type: Optional[str] = None
    material_group: Optional[str] = None

class MaterialResponse(BaseModel):
    material_code: str
    description: str
    uom: str
    material_type: Optional[str] = None
    material_group: Optional[str] = None
    class Config:
        from_attributes = True

# Stock
class StockResponse(BaseModel):
    id: int
    material_code: str
    plant_code: str
    storage_location_code: str
    wbs_code: Optional[str] = None
    available_qty: float
    blocked_qty: float
    quality_inspection_qty: float
    transit_qty: float
    stock_value: float
    updated_at: datetime
    class Config:
        from_attributes = True

# MB52 Upload History
class MB52UploadHistoryResponse(BaseModel):
    id: int
    filename: str
    uploaded_by: str
    uploaded_at: datetime
    status: str
    total_records: int
    discrepancies_found: int
    class Config:
        from_attributes = True

# Discrepancy
class DiscrepancyResponse(BaseModel):
    id: int
    upload_id: int
    material_code: str
    material_description: Optional[str] = None
    plant: str
    storage_location: str
    wbs: Optional[str] = None
    old_qty: float
    new_qty: float
    diff_qty: float
    diff_value: float
    reason: Optional[str] = None
    status: str
    responsible_person: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# MRF Line Items
class MRFLineItemCreate(BaseModel):
    sn: int
    material_code: str
    description: str
    uom: str
    requested_qty: float
    wbs_code: Optional[str] = None
    plant_code: Optional[str] = None
    storage_location_code: Optional[str] = None

class MRFLineItemResponse(BaseModel):
    id: int
    mrf_id: int
    sn: int
    reservation: Optional[str] = None
    material_code: str
    description: str
    uom: str
    requested_qty: float
    approved_qty: float
    issued_qty: float
    wbs_code: Optional[str] = None
    plant_code: Optional[str] = None
    storage_location_code: Optional[str] = None
    class Config:
        from_attributes = True

class MRFActionLogResponse(BaseModel):
    id: int
    mrf_id: int
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    actor_name: str
    actor_role: Optional[str] = None
    actor_email: Optional[str] = None
    comment: Optional[str] = None
    source: str
    created_at: datetime
    class Config:
        from_attributes = True

# MRF
class MRFCreate(BaseModel):
    date: str
    requested_by_name: str
    staff_mobile: Optional[str] = None
    department_id: Optional[int] = None
    project_code: Optional[str] = None
    issue_account_type: str = "project"
    cost_center_code: Optional[str] = None
    requestor_manager_name: Optional[str] = None
    requestor_manager_email: Optional[str] = None
    project_manager_name: Optional[str] = None
    project_manager_email: Optional[str] = None
    requested_from_warehouse_id: Optional[int] = None
    purpose: Optional[str] = None
    location: Optional[str] = None
    warehouse_poc_name: Optional[str] = None
    warehouse_poc_mobile: Optional[str] = None
    additional_poc_name: Optional[str] = None
    additional_poc_mobile: Optional[str] = None
    wbs_code: Optional[str] = None
    reference_pr: Optional[str] = None
    reference_po: Optional[str] = None
    comments: Optional[str] = None
    line_items: List[MRFLineItemCreate]
    requestor_signature: Optional[str] = None

class MRFUpdate(BaseModel):
    status: Optional[str] = None
    action: Optional[str] = "approve"
    # Approval signatures/details
    signature: Optional[str] = None
    approver_name: Optional[str] = None
    comments: Optional[str] = None
    # Approved quantities
    approved_quantities: Optional[dict] = None  # Mapping of line_item_id -> approved_qty
    # Stock selection details
    issuing_stock_selections: Optional[dict] = None  # Mapping of line_item_id (str) -> stock_id (int)
    # Issue/Dispatch details
    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    driver_iqama: Optional[str] = None
    transport_company: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_mobile: Optional[str] = None
    delivery_location: Optional[str] = None

class MRFResponse(BaseModel):
    id: int
    reference_number: str
    date: str
    requested_by_name: str
    staff_mobile: Optional[str] = None
    department_id: Optional[int] = None
    project_code: str
    issue_account_type: str = "project"
    cost_center_code: Optional[str] = None
    requested_from_warehouse_id: Optional[int] = None
    purpose: Optional[str] = None
    location: Optional[str] = None
    warehouse_poc_name: Optional[str] = None
    warehouse_poc_mobile: Optional[str] = None
    additional_poc_name: Optional[str] = None
    additional_poc_mobile: Optional[str] = None
    wbs_code: Optional[str] = None
    reference_pr: Optional[str] = None
    reference_po: Optional[str] = None
    total_qty: float
    comments: Optional[str] = None
    status: str
    
    requestor_signature: Optional[str] = None
    requestor_manager_signature: Optional[str] = None
    project_manager_signature: Optional[str] = None
    supervisor_signature: Optional[str] = None
    manager_signature: Optional[str] = None
    worker_signature: Optional[str] = None
    driver_signature: Optional[str] = None
    receiver_signature: Optional[str] = None

    requestor_manager_name: Optional[str] = None
    requestor_manager_email: Optional[str] = None
    project_manager_name: Optional[str] = None
    project_manager_email: Optional[str] = None
    supervisor_name: Optional[str] = None
    manager_name: Optional[str] = None
    worker_name: Optional[str] = None
    last_action_comment: Optional[str] = None
    last_action_by: Optional[str] = None
    last_action_at: Optional[datetime] = None

    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    driver_iqama: Optional[str] = None
    transport_company: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_mobile: Optional[str] = None
    delivery_location: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    line_items: List[MRFLineItemResponse]
    action_logs: List[MRFActionLogResponse] = []
    class Config:
        from_attributes = True

# Material Receiving
class MaterialReceivingLineItemCreate(BaseModel):
    material_code: str
    plant_code: str
    storage_location_code: str
    wbs_code: Optional[str] = None
    quantity: float
    remarks: Optional[str] = None

class MaterialReceivingLineItemResponse(BaseModel):
    id: int
    receiving_id: int
    material_code: str
    plant_code: str
    storage_location_code: str
    wbs_code: Optional[str] = None
    quantity: float
    remarks: Optional[str] = None
    class Config:
        from_attributes = True

class MaterialReceivingCreate(BaseModel):
    type: str  # PO, Delivery Note, Manual
    supplier: Optional[str] = None
    reference_number: Optional[str] = None
    received_date: str
    remarks: Optional[str] = None
    line_items: List[MaterialReceivingLineItemCreate]

class MaterialReceivingResponse(BaseModel):
    id: int
    receiving_number: str
    type: str
    supplier: Optional[str] = None
    reference_number: Optional[str] = None
    received_by: str
    checked_by: Optional[str] = None
    received_date: str
    remarks: Optional[str] = None
    status: str
    created_at: datetime
    line_items: List[MaterialReceivingLineItemResponse]
    class Config:
        from_attributes = True

# Material Transfer
class MaterialTransferLineItemCreate(BaseModel):
    material_code: str
    quantity: float

class MaterialTransferLineItemResponse(BaseModel):
    id: int
    transfer_id: int
    material_code: str
    quantity: float
    class Config:
        from_attributes = True

class MaterialTransferCreate(BaseModel):
    source_plant: str
    source_storage_location: str
    dest_plant: str
    dest_storage_location: str
    source_wbs: Optional[str] = None
    dest_wbs: Optional[str] = None
    remarks: Optional[str] = None
    line_items: List[MaterialTransferLineItemCreate]

class MaterialTransferResponse(BaseModel):
    id: int
    transfer_number: str
    source_plant: str
    source_storage_location: str
    dest_plant: str
    dest_storage_location: str
    source_wbs: Optional[str] = None
    dest_wbs: Optional[str] = None
    requested_by: str
    approved_by: Optional[str] = None
    status: str
    remarks: Optional[str] = None
    created_at: datetime
    line_items: List[MaterialTransferLineItemResponse]
    class Config:
        from_attributes = True

# Cancellation
class CancellationCreate(BaseModel):
    transaction_type: str  # MRF, Receiving, Transfer
    transaction_id: int
    reason: str

class CancellationResponse(BaseModel):
    id: int
    transaction_type: str
    transaction_id: int
    cancelled_by: str
    cancelled_at: datetime
    reason: str
    original_ref_number: str
    stock_impact_json: Optional[Any] = None
    class Config:
        from_attributes = True

# Audit Trail
class AuditTrailResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: str
    action: str
    timestamp: datetime
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    remarks: Optional[str] = None
    class Config:
        from_attributes = True

# Email Setting
class EmailSettingCreate(BaseModel):
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    sender_email: Optional[str] = None
    imap_server: Optional[str] = None
    imap_port: Optional[int] = None
    exchange_server: Optional[str] = None
    ssl_tls: Optional[bool] = True
    email_approval_enabled: Optional[bool] = False

class EmailSettingResponse(BaseModel):
    id: int
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    username: Optional[str] = None
    sender_email: Optional[str] = None
    imap_server: Optional[str] = None
    imap_port: Optional[int] = None
    exchange_server: Optional[str] = None
    ssl_tls: bool
    email_approval_enabled: bool
    class Config:
        from_attributes = True

# Attachment
class AttachmentResponse(BaseModel):
    id: int
    transaction_type: str
    transaction_id: int
    filename: str
    file_path: str
    uploaded_by: str
    uploaded_at: datetime
    class Config:
        from_attributes = True

# Company Settings
class CompanySettingCreate(BaseModel):
    company_name: str
    company_logo: Optional[str] = None
    address: Optional[str] = None
    plant: Optional[str] = None
    currency: Optional[str] = "USD"
    location: Optional[str] = None
    calendar: Optional[str] = None

class CompanySettingResponse(BaseModel):
    id: int
    company_name: str
    company_logo: Optional[str] = None
    address: Optional[str] = None
    plant: Optional[str] = None
    currency: Optional[str] = "USD"
    location: Optional[str] = None
    calendar: Optional[str] = None
    class Config:
        from_attributes = True

# Direct Issuance
class DirectIssueCreate(BaseModel):
    material_code: str
    plant_code: str
    storage_location_code: str
    wbs_code: Optional[str] = None
    quantity: float
    requested_by_name: str
    department_id: Optional[int] = None
    project_code: Optional[str] = None
    issue_account_type: str = "project"
    cost_center_code: Optional[str] = None
    purpose: Optional[str] = None
    
    # Transport details
    vehicle_number: str
    vehicle_type: Optional[str] = None
    driver_name: str
    driver_mobile: str
    driver_iqama: str
    transport_company: str
    receiver_name: str
    receiver_mobile: str
    delivery_location: Optional[str] = None
    
    remarks: Optional[str] = None
    signature: Optional[str] = None # Base64 hand signature
