export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Plant {
  code: string;
  name: string;
  location?: string;
}

export interface StorageLocation {
  code: string;
  plant_code: string;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
  location?: string;
  description?: string;
}

export interface Project {
  code: string;
  name: string;
  description?: string;
}

export interface WbsElement {
  code: string;
  project_code: string;
  description?: string;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
}

export interface CostCenter {
  code: string;
  name: string;
  description?: string;
}

export interface Material {
  material_code: string;
  description: string;
  uom: string;
  material_type?: string;
  material_group?: string;
}

export interface Stock {
  id: number;
  material_code: string;
  description?: string;
  uom?: string;
  material_type?: string;
  material_group?: string;
  plant_code: string;
  storage_location_code: string;
  wbs_code?: string;
  available_qty: number;
  blocked_qty: number;
  quality_inspection_qty: number;
  transit_qty: number;
  stock_value: number;
  updated_at: string;
}

export interface MB52UploadHistory {
  id: number;
  filename: string;
  uploaded_by: string;
  uploaded_at: string;
  status: string;
  total_records: number;
  discrepancies_found: number;
}

export interface Discrepancy {
  id: number;
  upload_id: number;
  material_code: string;
  material_description?: string;
  plant: string;
  storage_location: string;
  wbs?: string;
  old_qty: number;
  new_qty: number;
  diff_qty: number;
  diff_value: number;
  reason?: string;
  status: string;
  responsible_person?: string;
  created_at: string;
}

export interface MRFLineItem {
  id?: number;
  sn: number;
  material_code: string;
  description: string;
  uom: string;
  requested_qty: number;
  approved_qty: number;
  issued_qty: number;
  wbs_code?: string;
}

export interface MRFActionLog {
  id: number;
  mrf_id: number;
  action: string;
  from_status?: string;
  to_status?: string;
  actor_name?: string;
  actor_role?: string;
  actor_email?: string;
  comment?: string;
  source: string;
  created_at: string;
}

export interface MRF {
  id: number;
  reference_number: string;
  date: string;
  requested_by_name: string;
  staff_mobile?: string;
  department_id?: number;
  project_code: string;
  issue_account_type: string;
  cost_center_code?: string;
  requested_from_warehouse_id?: number;
  purpose?: string;
  location?: string;
  warehouse_poc_name?: string;
  warehouse_poc_mobile?: string;
  additional_poc_name?: string;
  additional_poc_mobile?: string;
  wbs_code?: string;
  reference_pr?: string;
  reference_po?: string;
  total_qty: number;
  comments?: string;
  status: string;
  
  requestor_signature?: string;
  requestor_manager_signature?: string;
  project_manager_signature?: string;
  supervisor_signature?: string;
  manager_signature?: string;
  worker_signature?: string;
  driver_signature?: string;
  receiver_signature?: string;

  requestor_manager_name?: string;
  requestor_manager_email?: string;
  project_manager_name?: string;
  project_manager_email?: string;
  supervisor_name?: string;
  manager_name?: string;
  worker_name?: string;
  last_action_comment?: string;
  last_action_by?: string;
  last_action_at?: string;

  vehicle_number?: string;
  vehicle_type?: string;
  driver_name?: string;
  driver_mobile?: string;
  driver_iqama?: string;
  transport_company?: string;
  receiver_name?: string;
  receiver_mobile?: string;
  delivery_location?: string;

  created_at: string;
  updated_at: string;
  line_items: MRFLineItem[];
  action_logs: MRFActionLog[];
}

export interface MaterialReceivingLineItem {
  material_code: string;
  plant_code: string;
  storage_location_code: string;
  wbs_code?: string;
  quantity: number;
  remarks?: string;
}

export interface MaterialReceiving {
  id: number;
  receiving_number: string;
  type: string;
  supplier?: string;
  reference_number?: string;
  received_by: string;
  checked_by?: string;
  received_date: string;
  remarks?: string;
  status: string;
  created_at: string;
  line_items: MaterialReceivingLineItem[];
}

export interface MaterialTransferLineItem {
  material_code: string;
  quantity: number;
}

export interface MaterialTransfer {
  id: number;
  transfer_number: string;
  source_plant: string;
  source_storage_location: string;
  dest_plant: string;
  dest_storage_location: string;
  source_wbs?: string;
  dest_wbs?: string;
  requested_by: string;
  approved_by?: string;
  status: string;
  remarks?: string;
  created_at: string;
  line_items: MaterialTransferLineItem[];
}

export interface Cancellation {
  id: number;
  transaction_type: string;
  transaction_id: number;
  cancelled_by: string;
  cancelled_at: string;
  reason: string;
  original_ref_number: string;
  stock_impact_json?: any;
}

export interface AuditTrail {
  id: number;
  user_id?: number;
  username: string;
  action: string;
  timestamp: string;
  old_value?: any;
  new_value?: any;
  remarks?: string;
}

export interface EmailSetting {
  smtp_server?: string;
  smtp_port?: number;
  username?: string;
  sender_email?: string;
  imap_server?: string;
  imap_port?: number;
  exchange_server?: string;
  ssl_tls: boolean;
  email_approval_enabled: boolean;
}

export interface CompanySetting {
  id: number;
  company_name: string;
  company_logo?: string;
  address?: string;
  plant?: string;
  currency?: string;
  location?: string;
  calendar?: string;
}
