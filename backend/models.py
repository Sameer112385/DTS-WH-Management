from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), index=True, nullable=False)
    mobile = Column(String(50), nullable=True)
    role = Column(String(50), nullable=False)  # Admin, Warehouse Manager, Warehouse Supervisor, Warehouse Worker, Requestor, Requestor Manager
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Plant(Base):
    __tablename__ = "plants"
    code = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class StorageLocation(Base):
    __tablename__ = "storage_locations"
    code = Column(String(50), primary_key=True, index=True)
    plant_code = Column(String(50), ForeignKey("plants.code"), primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Project(Base):
    __tablename__ = "projects"
    code = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WbsElement(Base):
    __tablename__ = "wbs_elements"
    code = Column(String(50), primary_key=True, index=True)
    project_code = Column(String(50), ForeignKey("projects.code"), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CostCenter(Base):
    __tablename__ = "cost_centers"
    code = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Material(Base):
    __tablename__ = "materials"
    material_code = Column(String(50), primary_key=True, index=True)
    description = Column(Text, nullable=False)
    uom = Column(String(20), nullable=False)
    material_type = Column(String(50), nullable=True)
    material_group = Column(String(50), nullable=True)

class Stock(Base):
    __tablename__ = "stock"
    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), ForeignKey("materials.material_code"), nullable=False)
    plant_code = Column(String(50), nullable=False)
    storage_location_code = Column(String(50), nullable=False)
    wbs_code = Column(String(50), nullable=True)
    available_qty = Column(Float, default=0.0)
    blocked_qty = Column(Float, default=0.0)
    quality_inspection_qty = Column(Float, default=0.0)
    transit_qty = Column(Float, default=0.0)
    stock_value = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class MB52UploadHistory(Base):
    __tablename__ = "mb52_upload_history"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(200), nullable=False)
    uploaded_by = Column(String(50), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default="Success")  # Success, Failed
    total_records = Column(Integer, default=0)
    discrepancies_found = Column(Integer, default=0)

class Discrepancy(Base):
    __tablename__ = "discrepancies"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("mb52_upload_history.id"), nullable=False)
    material_code = Column(String(50), nullable=False)
    material_description = Column(Text, nullable=True)
    plant = Column(String(50), nullable=False)
    storage_location = Column(String(50), nullable=False)
    wbs = Column(String(50), nullable=True)
    old_qty = Column(Float, default=0.0)
    new_qty = Column(Float, default=0.0)
    diff_qty = Column(Float, default=0.0)
    diff_value = Column(Float, default=0.0)
    reason = Column(String(255), nullable=True)
    status = Column(String(50), default="Pending")  # Pending, Resolved
    responsible_person = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MRF(Base):
    __tablename__ = "mrfs"
    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String(100), unique=True, index=True, nullable=False)
    date = Column(String(50), nullable=False)
    requested_by_name = Column(String(100), nullable=False)
    staff_mobile = Column(String(50), nullable=True)
    department_id = Column(Integer, nullable=True)
    project_code = Column(String(50), nullable=False)
    issue_account_type = Column(String(20), nullable=False, default="project")
    cost_center_code = Column(String(50), nullable=True)
    requested_from_warehouse_id = Column(Integer, nullable=True)
    purpose = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    warehouse_poc_name = Column(String(100), nullable=True)
    warehouse_poc_mobile = Column(String(50), nullable=True)
    additional_poc_name = Column(String(100), nullable=True)
    additional_poc_mobile = Column(String(50), nullable=True)
    wbs_code = Column(String(50), nullable=True)
    reference_pr = Column(String(100), nullable=True)
    reference_po = Column(String(100), nullable=True)
    total_qty = Column(Float, default=0.0)
    comments = Column(Text, nullable=True)
    
    # Approval configuration
    status = Column(String(100), default="Pending Requestor Manager Approval")
    # Signatures (can be Base64 string for hand-drawn signature or approval user initials)
    requestor_signature = Column(Text, nullable=True)
    requestor_manager_signature = Column(Text, nullable=True)
    project_manager_signature = Column(Text, nullable=True)
    supervisor_signature = Column(Text, nullable=True)
    manager_signature = Column(Text, nullable=True)
    worker_signature = Column(Text, nullable=True)
    driver_signature = Column(Text, nullable=True)
    receiver_signature = Column(Text, nullable=True)

    # Approver Names
    requestor_manager_name = Column(String(100), nullable=True)
    requestor_manager_email = Column(String(255), nullable=True)
    project_manager_name = Column(String(100), nullable=True)
    project_manager_email = Column(String(255), nullable=True)
    supervisor_name = Column(String(100), nullable=True)
    manager_name = Column(String(100), nullable=True)
    worker_name = Column(String(100), nullable=True)
    last_action_comment = Column(Text, nullable=True)
    last_action_by = Column(String(100), nullable=True)
    last_action_at = Column(DateTime(timezone=True), nullable=True)

    # Delivery & Dispatch Transport Details
    vehicle_number = Column(String(50), nullable=True)
    vehicle_type = Column(String(50), nullable=True)
    driver_name = Column(String(100), nullable=True)
    driver_mobile = Column(String(50), nullable=True)
    driver_iqama = Column(String(50), nullable=True)
    transport_company = Column(String(100), nullable=True)
    receiver_name = Column(String(100), nullable=True)
    receiver_mobile = Column(String(50), nullable=True)
    delivery_location = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    line_items = relationship("MRFLineItem", back_populates="mrf", cascade="all, delete-orphan")
    action_logs = relationship("MRFActionLog", back_populates="mrf", cascade="all, delete-orphan", order_by="MRFActionLog.created_at")

class MRFLineItem(Base):
    __tablename__ = "mrf_line_items"
    id = Column(Integer, primary_key=True, index=True)
    mrf_id = Column(Integer, ForeignKey("mrfs.id"), nullable=False)
    sn = Column(Integer, nullable=False)
    reservation = Column(String(100), nullable=True)
    material_code = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    uom = Column(String(20), nullable=False)
    requested_qty = Column(Float, default=0.0)
    approved_qty = Column(Float, default=0.0)
    issued_qty = Column(Float, default=0.0)
    wbs_code = Column(String(50), nullable=True)
    plant_code = Column(String(50), nullable=True)
    storage_location_code = Column(String(50), nullable=True)

    mrf = relationship("MRF", back_populates="line_items")

class StockIssueMovement(Base):
    __tablename__ = "stock_issue_movements"
    id = Column(Integer, primary_key=True, index=True)
    mrf_id = Column(Integer, ForeignKey("mrfs.id"), nullable=False, index=True)
    mrf_line_item_id = Column(Integer, ForeignKey("mrf_line_items.id"), nullable=False, index=True)
    stock_id = Column(Integer, nullable=True)
    material_code = Column(String(50), nullable=False)
    plant_code = Column(String(50), nullable=False)
    storage_location_code = Column(String(50), nullable=False)
    wbs_code = Column(String(50), nullable=True)
    quantity = Column(Float, default=0.0)
    stock_value = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MRFActionLog(Base):
    __tablename__ = "mrf_action_logs"
    id = Column(Integer, primary_key=True, index=True)
    mrf_id = Column(Integer, ForeignKey("mrfs.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    from_status = Column(String(100), nullable=True)
    to_status = Column(String(100), nullable=True)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(100), nullable=True)
    actor_email = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)
    source = Column(String(30), nullable=False, default="app")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mrf = relationship("MRF", back_populates="action_logs")

class MaterialReceiving(Base):
    __tablename__ = "material_receivings"
    id = Column(Integer, primary_key=True, index=True)
    receiving_number = Column(String(100), unique=True, index=True, nullable=False)
    type = Column(String(50), nullable=False)  # PO, Delivery Note, Manual
    supplier = Column(String(200), nullable=True)
    reference_number = Column(String(100), nullable=True)  # PO or DN #
    received_by = Column(String(100), nullable=False)
    checked_by = Column(String(100), nullable=True)
    received_date = Column(String(50), nullable=False)
    remarks = Column(Text, nullable=True)
    status = Column(String(50), default="Received")  # Received, Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    line_items = relationship("MaterialReceivingLineItem", back_populates="receiving", cascade="all, delete-orphan")

class MaterialReceivingLineItem(Base):
    __tablename__ = "material_receiving_line_items"
    id = Column(Integer, primary_key=True, index=True)
    receiving_id = Column(Integer, ForeignKey("material_receivings.id"), nullable=False)
    material_code = Column(String(50), nullable=False)
    plant_code = Column(String(50), nullable=False)
    storage_location_code = Column(String(50), nullable=False)
    wbs_code = Column(String(50), nullable=True)
    quantity = Column(Float, default=0.0)
    remarks = Column(Text, nullable=True)

    receiving = relationship("MaterialReceiving", back_populates="line_items")

class MaterialTransfer(Base):
    __tablename__ = "material_transfers"
    id = Column(Integer, primary_key=True, index=True)
    transfer_number = Column(String(100), unique=True, index=True, nullable=False)
    source_plant = Column(String(50), nullable=False)
    source_storage_location = Column(String(50), nullable=False)
    dest_plant = Column(String(50), nullable=False)
    dest_storage_location = Column(String(50), nullable=False)
    source_wbs = Column(String(50), nullable=True)
    dest_wbs = Column(String(50), nullable=True)
    requested_by = Column(String(100), nullable=False)
    approved_by = Column(String(100), nullable=True)
    status = Column(String(50), default="Pending Approval")  # Pending Approval, Transferred, Cancelled
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    line_items = relationship("MaterialTransferLineItem", back_populates="transfer", cascade="all, delete-orphan")

class MaterialTransferLineItem(Base):
    __tablename__ = "material_transfer_line_items"
    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("material_transfers.id"), nullable=False)
    material_code = Column(String(50), nullable=False)
    quantity = Column(Float, default=0.0)

    transfer = relationship("MaterialTransfer", back_populates="line_items")

class Cancellation(Base):
    __tablename__ = "cancellations"
    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(50), nullable=False)  # MRF, Receiving, Transfer
    transaction_id = Column(Integer, nullable=False)
    cancelled_by = Column(String(100), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text, nullable=False)
    original_ref_number = Column(String(100), nullable=False)
    stock_impact_json = Column(JSON, nullable=True)

class AuditTrail(Base):
    __tablename__ = "audit_trails"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)  # Created, Approved, Issued, MB52 Uploaded, Cancelled, etc.
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    remarks = Column(Text, nullable=True)

class EmailSetting(Base):
    __tablename__ = "email_settings"
    id = Column(Integer, primary_key=True, default=1)
    smtp_server = Column(String(100), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    username = Column(String(100), nullable=True)
    password = Column(String(100), nullable=True)
    sender_email = Column(String(100), nullable=True)
    imap_server = Column(String(100), nullable=True)
    imap_port = Column(Integer, nullable=True)
    exchange_server = Column(String(100), nullable=True)
    ssl_tls = Column(Boolean, default=True)
    email_approval_enabled = Column(Boolean, default=False)

class CompanySetting(Base):
    __tablename__ = "company_settings"
    id = Column(Integer, primary_key=True, default=1)
    company_name = Column(String(100), default="WAREHOUSE")
    company_logo = Column(Text, nullable=True)
    address = Column(String(200), nullable=True)
    plant = Column(String(100), nullable=True)
    currency = Column(String(50), default="USD")
    location = Column(String(100), nullable=True)
    calendar = Column(String(100), nullable=True)

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(50), nullable=False)  # MRF, Receiving, Transfer, MB52
    transaction_id = Column(Integer, nullable=False)
    filename = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
