import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Download, CheckCircle, XCircle, Clock, 
  Truck, ArrowRight, UserCheck, Trash2, Printer 
} from 'lucide-react';
import { MRF, User, Department, Warehouse } from '../types';

interface MRFListProps {
  mrfs: MRF[];
  user: User | null;
  departments: Department[];
  warehouses: Warehouse[];
  apiBase: string;
  token: string;
  onRefresh: () => void;
}

const MRFList: React.FC<MRFListProps> = ({
  mrfs,
  user,
  departments,
  warehouses,
  apiBase,
  token,
  onRefresh
}) => {
  const [selectedMrf, setSelectedMrf] = useState<MRF | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  // Approvation states
  const [comments, setComments] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | 'send_back' | 'resubmit'>('approve');
  const [approvedQuantities, setApprovedQuantities] = useState<Record<number, number>>({});
  
  // Stock Selection states
  const [stockOptions, setStockOptions] = useState<Record<string, any[]>>({});
  const [strictWbsCheck, setStrictWbsCheck] = useState<boolean>(true);
  const [issuingStockSelections, setIssuingStockSelections] = useState<Record<number, number>>({});

  const loadStockOptions = async (mrf: MRF) => {
    const newOptions: Record<string, any[]> = {};
    for (const item of mrf.line_items) {
      try {
        const res = await fetch(`${apiBase}/materials/stock?material_code=${item.material_code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          newOptions[item.material_code] = data;
        }
      } catch (err) {
        console.error(err);
      }
    }
    setStockOptions(newOptions);
  };

  // Dispatch/Issuance states (required before worker confirms issue)
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Flatbed Truck');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [driverIqama, setDriverIqama] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Cancellation states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Drawing canvas for approval signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (selectedMrf) {
      // Initialize approved quantities for supervisor editing
      const qtys: Record<number, number> = {};
      selectedMrf.line_items.forEach(item => {
        if (item.id) qtys[item.id] = item.approved_qty;
      });
      setApprovedQuantities(qtys);
      
      // Auto fill transport default values for mock test
      setVehicleNumber('B-X-9884');
      setDriverName('Ahmad Al-Harbi');
      setDriverMobile('+966551234567');
      setDriverIqama('2441998471');
      setTransportCompany('Al-Majd Transport Co.');
      setReceiverName(selectedMrf.requested_by_name);
      setReceiverMobile(selectedMrf.staff_mobile || '+966500000000');
      setDeliveryLocation(selectedMrf.location || 'Site C-1');
    }
  }, [selectedMrf]);

  // Set up signature canvas drawing mouse/touch events
  useEffect(() => {
    if (selectedMrf) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 200);
    }
  }, [selectedMrf, isApproving]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleApprove = async () => {
    if (!selectedMrf || !user) return;

    let signatureBase64 = '';
    const signatureRequired = decisionAction !== 'resubmit';
    if (signatureRequired) {
      const canvas = canvasRef.current;
      if (canvas) {
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        if (canvas.toDataURL() !== blank.toDataURL()) {
          signatureBase64 = canvas.toDataURL();
        }
      }
    }

    if (signatureRequired && !signatureBase64) {
      alert("Hand-drawn signature is required to verify approval");
      return;
    }
    if ((decisionAction === 'reject' || decisionAction === 'send_back' || decisionAction === 'resubmit') && !comments.trim()) {
      alert("Comments are required for reject, send back, and resubmit.");
      return;
    }

    // Prepare update payload
    const payload: any = {
      action: decisionAction,
      approver_name: user.name,
      comments: comments
    };
    if (signatureBase64) payload.signature = signatureBase64;

    if (selectedMrf.status === 'Pending Warehouse Supervisor Check') {
      payload.approved_quantities = approvedQuantities;
    }

    if (selectedMrf.status === 'Ready to Issue') {
      if (decisionAction === 'approve') {
        for (const item of selectedMrf.line_items) {
          if (item.approved_qty > 0 && !issuingStockSelections[item.id!]) {
            alert(`Please select an issuing stock location/WBS for material: ${item.material_code}`);
            return;
          }
        }
      }
      payload.vehicle_number = vehicleNumber;
      payload.vehicle_type = vehicleType;
      payload.driver_name = driverName;
      payload.driver_mobile = driverMobile;
      payload.driver_iqama = driverIqama;
      payload.transport_company = transportCompany;
      payload.receiver_name = receiverName;
      payload.receiver_mobile = receiverMobile;
      payload.delivery_location = deliveryLocation;
      payload.issuing_stock_selections = issuingStockSelections;
    }

    try {
      const res = await fetch(`${apiBase}/mrf/${selectedMrf.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Approval submission failed.');
      }

      const updated = await res.json();
      setSelectedMrf(updated);
      setComments('');
      setIsApproving(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleCancelTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMrf || !cancelReason) return;

    try {
      const res = await fetch(`${apiBase}/reports/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transaction_type: 'MRF',
          transaction_id: selectedMrf.id,
          reason: cancelReason
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Cancellation failed.');
      }

      setShowCancelModal(false);
      setCancelReason('');
      setSelectedMrf(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel transaction.');
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedMrf || !user) return;
    const reason = prompt("Enter reason for cancelling this request (required):");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("Cancellation reason is required");
      return;
    }
    
    try {
      const res = await fetch(`${apiBase}/mrf/${selectedMrf.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'cancel',
          approver_name: user.name,
          comments: reason
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Cancellation failed.');
      }
      
      const updated = await res.json();
      setSelectedMrf(updated);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel request.');
    }
  };

  const handleDownloadPdf = async (mrf: MRF) => {
    try {
      window.open(`${apiBase}/mrf/${mrf.id}/pdf?token=${token}`, '_blank');
    } catch (err) {
      alert("Failed to download PDF.");
    }
  };

  // Determine if active user can approve at current stage
  const canUserApprove = (mrf: MRF): boolean => {
    if (!user) return false;
    const role = user.role;
    
    if (mrf.status === 'Pending Requestor Manager Approval') {
      return role === 'Requestor Manager' || role === 'Admin';
    }
    if (mrf.status === 'Sent Back to Requestor') {
      return role === 'Requestor' || role === 'Admin';
    }
    if (mrf.status === 'Pending Warehouse Supervisor Check') {
      return role === 'Warehouse Supervisor' || role === 'Admin';
    }
    if (mrf.status === 'Pending Warehouse Manager Approval') {
      return role === 'Warehouse Manager' || role === 'Admin';
    }
    if (mrf.status === 'Ready to Issue') {
      return role === 'Warehouse Worker' || role === 'Warehouse Supervisor' || role === 'Warehouse Manager' || role === 'Admin';
    }
    return false;
  };

  const filteredMrfs = mrfs.filter(mrf => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return mrf.status.startsWith('Pending') || mrf.status === 'Ready to Issue' || mrf.status === 'Sent Back to Requestor';
    if (activeFilter === 'issued') return mrf.status === 'Issued';
    if (activeFilter === 'cancelled') return mrf.status === 'Cancelled' || mrf.status === 'Rejected';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Filters bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending Approvals / Issue' },
            { id: 'issued', label: 'Dispatched & Issued' },
            { id: 'cancelled', label: 'Cancelled Forms' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`btn ${activeFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of requests */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Reference Number</th>
                <th>Request Date</th>
                <th>Requestor</th>
                <th>Issue Target</th>
                <th>Total Qty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMrfs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No Material Request Forms found matching selection.
                  </td>
                </tr>
              ) : (
                filteredMrfs.map(mrf => (
                  <tr key={mrf.id}>
                    <td style={{ fontWeight: 600 }}>{mrf.reference_number}</td>
                    <td>{mrf.date}</td>
                    <td>{mrf.requested_by_name}</td>
                    <td>{mrf.issue_account_type === 'cost_center' ? `CC: ${mrf.cost_center_code}` : mrf.project_code}</td>
                    <td>{mrf.total_qty} units</td>
                    <td>
                      <span className={`badge ${
                        mrf.status === 'Issued' ? 'badge-success' :
                        (mrf.status === 'Cancelled' || mrf.status === 'Rejected') ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {mrf.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => setSelectedMrf(mrf)}
                        >
                          View Details
                        </button>
                        {mrf.status === 'Issued' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                            onClick={() => handleDownloadPdf(mrf)}
                          >
                            <Download size={12} />
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Popup Modal */}
      {selectedMrf && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '850px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>MRF details for {selectedMrf.reference_number}</h2>
                <span className={`badge ${
                  selectedMrf.status === 'Issued' ? 'badge-success' :
                  (selectedMrf.status === 'Cancelled' || selectedMrf.status === 'Rejected') ? 'badge-danger' : 'badge-warning'
                }`} style={{ marginTop: '0.3rem' }}>
                  {selectedMrf.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedMrf.status === 'Issued' && (
                  <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }} onClick={() => handleDownloadPdf(selectedMrf)}>
                    <Printer size={14} />
                    Download Form
                  </button>
                )}
                {user?.role === 'Warehouse Manager' && selectedMrf.status !== 'Cancelled' && (
                  <button className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }} onClick={() => setShowCancelModal(true)}>
                    <XCircle size={14} />
                    Cancel Transaction
                  </button>
                )}
                {selectedMrf.status !== 'Issued' && selectedMrf.status !== 'Cancelled' && selectedMrf.status !== 'Rejected' && (
                  <button className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }} onClick={handleCancelRequest}>
                    <XCircle size={14} />
                    Cancel Request
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => { setSelectedMrf(null); setIsApproving(false); }}>Close</button>
              </div>
            </div>

            {/* General Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requestor</p>
                <p style={{ fontWeight: 550 }}>{selectedMrf.requested_by_name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedMrf.staff_mobile}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Department</p>
                <p style={{ fontWeight: 550 }}>Dept #{selectedMrf.department_id || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issue Target</p>
                <p style={{ fontWeight: 550 }}>
                  {selectedMrf.issue_account_type === 'cost_center'
                    ? `Cost Center ${selectedMrf.cost_center_code || 'N/A'}`
                    : `${selectedMrf.project_code} • ${selectedMrf.wbs_code || 'N/A'}`}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Warehouse Destination</p>
                <p style={{ fontWeight: 550 }}>WH #{selectedMrf.requested_from_warehouse_id || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requestor/Project Manager</p>
                <p style={{ fontWeight: 550 }}>{selectedMrf.requestor_manager_name || 'N/A'}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedMrf.requestor_manager_email || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ref PO</p>
                <p style={{ fontWeight: 550 }}>{selectedMrf.reference_po || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Purpose</p>
                <p style={{ fontWeight: 550 }}>{selectedMrf.purpose || 'N/A'}</p>
              </div>
            </div>

            {/* Material lines */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Requested Materials</h3>
              {isApproving && selectedMrf.status === 'Ready to Issue' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={strictWbsCheck}
                    onChange={e => setStrictWbsCheck(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  Strict WBS Check (Filter stock by matching WBS)
                </label>
              )}
            </div>

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Material Code</th>
                    <th>Description</th>
                    <th>UOM</th>
                    <th>Requested Qty</th>
                    <th>Approved Qty</th>
                    <th>Issued Qty</th>
                    <th>{selectedMrf.issue_account_type === 'cost_center' ? 'Cost Center' : 'Line WBS Element'}</th>
                    {isApproving && selectedMrf.status === 'Ready to Issue' && <th>Issuing Stock Location / WBS</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedMrf.line_items.map(item => (
                    <tr key={item.id}>
                      <td>{item.sn}</td>
                      <td style={{ fontWeight: 600 }}>{item.material_code}</td>
                      <td>{item.description}</td>
                      <td>{item.uom}</td>
                      <td>{item.requested_qty}</td>
                      <td>
                        {isApproving && selectedMrf.status === 'Pending Warehouse Supervisor Check' ? (
                          <input
                            type="number"
                            className="input-field"
                            style={{ width: '80px', padding: '0.3rem 0.5rem' }}
                            value={approvedQuantities[item.id!] || 0}
                            onChange={e => setApprovedQuantities({
                              ...approvedQuantities,
                              [item.id!]: parseFloat(e.target.value) || 0
                            })}
                          />
                        ) : (
                          item.approved_qty
                        )}
                      </td>
                      <td>{item.issued_qty}</td>
                      <td>{selectedMrf.issue_account_type === 'cost_center' ? (selectedMrf.cost_center_code || 'N/A') : (item.wbs_code || selectedMrf.wbs_code || 'N/A')}</td>
                      {isApproving && selectedMrf.status === 'Ready to Issue' && (
                        <td>
                          <select
                            className="input-field"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: '250px' }}
                            value={issuingStockSelections[item.id!] || ''}
                            onChange={e => setIssuingStockSelections({
                              ...issuingStockSelections,
                              [item.id!]: parseInt(e.target.value) || 0
                            })}
                            required
                          >
                            <option value="">-- Select Issuing Stock --</option>
                            {(stockOptions[item.material_code] || [])
                              .filter(stock => {
                                if (!strictWbsCheck) return true;
                                const targetWbs = item.wbs_code || selectedMrf.wbs_code || '';
                                return stock.wbs_code === targetWbs;
                              })
                              .map(stock => (
                                <option key={stock.id} value={stock.id}>
                                  {stock.plant_code}/{stock.storage_location_code} | WBS: {stock.wbs_code || 'Unrestricted'} (Avail: {stock.available_qty})
                                </option>
                              ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Transport details (if Issued) */}
            {(selectedMrf.status === 'Issued' || selectedMrf.vehicle_number) && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                  <Truck size={16} />
                  Transportation & Dispatch Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                  <div><b>Vehicle No / Type:</b> {selectedMrf.vehicle_number} ({selectedMrf.vehicle_type})</div>
                  <div><b>Driver Name:</b> {selectedMrf.driver_name}</div>
                  <div><b>Driver Mobile:</b> {selectedMrf.driver_mobile}</div>
                  <div><b>Driver Iqama:</b> {selectedMrf.driver_iqama}</div>
                  <div><b>Transport Co:</b> {selectedMrf.transport_company}</div>
                  <div><b>Receiver Details:</b> {selectedMrf.receiver_name} ({selectedMrf.receiver_mobile})</div>
                </div>
              </div>
            )}

            {/* Approval flow stages representation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <p style={{ fontWeight: 650, color: 'var(--text-muted)' }}>Approval Stage Summary</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                  <b>1. Requestor Mgr</b><br/>
                  {selectedMrf.requestor_manager_signature ? `Approved by ${selectedMrf.requestor_manager_name || 'Manager'}` : 'Pending'}
                </div>
                <div style={{ padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                  <b>2. Whse Supervisor</b><br/>
                  {selectedMrf.supervisor_signature ? `Checked by ${selectedMrf.supervisor_name}` : 'Pending'}
                </div>
                <div style={{ padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                  <b>3. Whse Manager</b><br/>
                  {selectedMrf.manager_signature ? `Approved by ${selectedMrf.manager_name}` : 'Pending'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 650, color: 'var(--text-muted)', marginBottom: '0.85rem' }}>Approval History Timeline</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {(selectedMrf.action_logs || []).length === 0 ? (
                  <div style={{ padding: '0.9rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>
                    No approval actions recorded yet.
                  </div>
                ) : (
                  [...selectedMrf.action_logs]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((log, index) => (
                      <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: '0.85rem', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '999px', background: log.action === 'reject' ? 'var(--danger)' : log.action === 'send_back' ? '#f59e0b' : 'var(--primary)' }} />
                          {index !== (selectedMrf.action_logs.length - 1) && (
                            <div style={{ flex: 1, width: '2px', background: 'rgba(255,255,255,0.08)', marginTop: '0.3rem' }} />
                          )}
                        </div>
                        <div style={{ padding: '0.9rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                            <div style={{ fontWeight: 650 }}>
                              {(log.action || 'updated').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            {log.actor_name || 'System'} {log.actor_role ? `(${log.actor_role})` : ''} {log.source ? `via ${log.source}` : ''}
                          </div>
                          <div style={{ fontSize: '0.82rem', marginBottom: log.comment ? '0.45rem' : 0 }}>
                            {log.from_status || 'N/A'} {' -> '} {log.to_status || 'N/A'}
                          </div>
                          {log.comment && (
                            <div style={{ fontSize: '0.85rem', padding: '0.65rem', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.14)' }}>
                              {log.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {(selectedMrf.last_action_comment || selectedMrf.last_action_by) && (
              <div style={{ marginBottom: '1.5rem', padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Latest Review Note</p>
                <p style={{ marginBottom: '0.35rem' }}>{selectedMrf.last_action_comment || 'N/A'}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  By {selectedMrf.last_action_by || 'N/A'} {selectedMrf.last_action_at ? `on ${new Date(selectedMrf.last_action_at).toLocaleString()}` : ''}
                </p>
              </div>
            )}

            {/* Approval Action Form Panel */}
            {canUserApprove(selectedMrf) && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                {!isApproving ? (
                  <button className="btn btn-primary" onClick={() => {
                    setIsApproving(true);
                    setDecisionAction(selectedMrf.status === 'Sent Back to Requestor' ? 'resubmit' : 'approve');
                    if (selectedMrf.status === 'Ready to Issue') {
                      loadStockOptions(selectedMrf);
                    }
                  }}>
                    {selectedMrf.status === 'Sent Back to Requestor' ? 'Resubmit Request' : 'Process Approval / Issuance Stage'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--primary)' }}>Sign & Approve Form</h3>

                    <div className="form-group">
                      <label className="form-label">Decision</label>
                      <select
                        className="input-field"
                        value={decisionAction}
                        onChange={e => setDecisionAction(e.target.value as any)}
                      >
                        {selectedMrf.status === 'Sent Back to Requestor' ? (
                          <option value="resubmit">Resubmit</option>
                        ) : (
                          <>
                            <option value="approve">{selectedMrf.status === 'Ready to Issue' ? 'Approve & Issue' : 'Approve'}</option>
                            <option value="send_back">Send Back</option>
                            <option value="reject">Reject</option>
                          </>
                        )}
                      </select>
                    </div>
                    
                    {/* If worker is issuing, show Driver Validation Fields */}
                    {selectedMrf.status === 'Ready to Issue' && decisionAction === 'approve' && (
                      <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Truck size={14} />
                          Driver & Vehicle Dispatch Inputs (Required)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label">Vehicle Plate Number</label>
                            <input type="text" required className="input-field" value={vehicleNumber} onChange={e=>setVehicleNumber(e.target.value)} placeholder="e.g. B-X-9884" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Vehicle Type</label>
                            <input type="text" className="input-field" value={vehicleType} onChange={e=>setVehicleType(e.target.value)} placeholder="e.g. Flatbed Truck" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Driver Full Name</label>
                            <input type="text" required className="input-field" value={driverName} onChange={e=>setDriverName(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Driver Mobile Number</label>
                            <input type="text" required className="input-field" value={driverMobile} onChange={e=>setDriverMobile(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Driver Iqama / ID Number</label>
                            <input type="text" required className="input-field" value={driverIqama} onChange={e=>setDriverIqama(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Transport Company Name</label>
                            <input type="text" required className="input-field" value={transportCompany} onChange={e=>setTransportCompany(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Receiver Name</label>
                            <input type="text" required className="input-field" value={receiverName} onChange={e=>setReceiverName(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Receiver Mobile Number</label>
                            <input type="text" required className="input-field" value={receiverMobile} onChange={e=>setReceiverMobile(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* General comments */}
                    <div className="form-group">
                      <label className="form-label">Comments / Remarks</label>
                      <input
                        type="text"
                        className="input-field"
                        value={comments}
                        onChange={e=>setComments(e.target.value)}
                        placeholder={decisionAction === 'approve' ? 'Optional approval note' : 'Reason / note is required'}
                      />
                    </div>

                    {/* Canvas signature drawer */}
                    <div style={{ display: 'grid', gridTemplateColumns: decisionAction === 'resubmit' ? '1fr' : '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                      {decisionAction !== 'resubmit' && (
                      <div className="form-group">
                        <label className="form-label">Draw Approval Hand Signature (Required)</label>
                        <div className="signature-canvas-container" style={{ height: '100px' }}>
                          <canvas
                            ref={canvasRef}
                            width={320}
                            height={100}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                          />
                        </div>
                      </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {decisionAction !== 'resubmit' && (
                          <button type="button" className="btn btn-secondary" onClick={() => {
                            const canvas = canvasRef.current;
                            const ctx = canvas?.getContext('2d');
                            if (canvas && ctx) ctx.clearRect(0,0, canvas.width, canvas.height);
                          }}>Clear Signature</button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={() => setIsApproving(false)}>Cancel</button>
                        <button type="button" className={`btn ${decisionAction === 'reject' ? 'btn-danger' : 'btn-primary'}`} onClick={handleApprove}>
                          {decisionAction === 'approve' ? (selectedMrf.status === 'Ready to Issue' ? 'Confirm Issue' : 'Confirm Approval') :
                           decisionAction === 'send_back' ? 'Send Back' :
                           decisionAction === 'reject' ? 'Reject Request' : 'Resubmit Request'}
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Transaction Cancellation Modal */}
      {showCancelModal && selectedMrf && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--danger)' }}>
              Confirm Cancel Transaction {selectedMrf.reference_number}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Warning: Cancelling this issued material form will reverse all stock items back to the source inventory. This action is tracked in the audit trail and cannot be deleted.
            </p>

            <form onSubmit={handleCancelTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Reason for Cancellation</label>
                <textarea
                  required
                  className="input-field"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="State the reason for roll-back..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                  Go Back
                </button>
                <button type="submit" className="btn btn-danger">
                  Execute Rollback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MRFList;
