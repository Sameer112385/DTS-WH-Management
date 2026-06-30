import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash, FileText, CheckCircle, PenTool, Eraser } from 'lucide-react';
import { Material, Department, Project, Warehouse, WbsElement, CostCenter, Plant, StorageLocation } from '../types';
import SearchableMaterialSelect from './SearchableMaterialSelect';
import SearchableSelect from './SearchableSelect';

interface MRFFormProps {
  apiBase: string;
  token: string;
  departments: Department[];
  projects: Project[];
  warehouses: Warehouse[];
  wbsElements: WbsElement[];
  plants: Plant[];
  storageLocations: StorageLocation[];
  onSuccess: () => void;
  onCancel: () => void;
}

interface LineItem {
  sn: number;
  material_code: string;
  description: string;
  uom: string;
  requested_qty: number;
  wbs_code: string;
  plant_code: string;
  storage_location_code: string;
}

const MRFForm: React.FC<MRFFormProps> = ({
  apiBase,
  token,
  departments,
  projects,
  warehouses,
  wbsElements,
  plants,
  storageLocations,
  onSuccess,
  onCancel
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestedBy, setRequestedBy] = useState('');
  const [staffMobile, setStaffMobile] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedProj, setSelectedProj] = useState('');
  const [issueAccountType, setIssueAccountType] = useState<'project' | 'cost_center'>('project');
  const [selectedCostCenter, setSelectedCostCenter] = useState('');
  const [requestorManagerName, setRequestorManagerName] = useState('');
  const [requestorManagerEmail, setRequestorManagerEmail] = useState('');
  const [projectManagerName, setProjectManagerName] = useState('');
  const [projectManagerEmail, setProjectManagerEmail] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [purpose, setPurpose] = useState('');
  const [location, setLocation] = useState('');
  const [warehousePoc, setWarehousePoc] = useState('');
  const [warehousePocMobile, setWarehousePocMobile] = useState('');
  const [additionalPoc, setAdditionalPoc] = useState('');
  const [additionalPocMobile, setAdditionalPocMobile] = useState('');
  const [selectedWbs, setSelectedWbs] = useState('');
  const [referencePr, setReferencePr] = useState('');
  const [referencePo, setReferencePo] = useState('');
  const [comments, setComments] = useState('');

  const defaultPlant = plants[0]?.code || 'PL01';
  const defaultLoc = storageLocations.find(l => l.plant_code === defaultPlant)?.code || 'SL01';

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { sn: 1, material_code: '', description: '', uom: 'EA', requested_qty: 0, wbs_code: '', plant_code: defaultPlant, storage_location_code: defaultLoc }
  ]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});

  const fetchStockForMaterial = async (materialCode: string) => {
    if (!materialCode) return;
    try {
      const res = await fetch(`${apiBase}/materials/stock?material_code=${encodeURIComponent(materialCode)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const total = data.reduce((acc: number, curr: any) => acc + (curr.available_qty || 0), 0);
        setStockLevels(prev => ({ ...prev, [materialCode]: total }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load materials list for autocomplete
  useEffect(() => {
    fetch(`${apiBase}/materials/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMaterials(data))
      .catch(err => console.error(err));

    fetch(`${apiBase}/company/cost-centers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setCostCenters(data))
      .catch(err => console.error(err));
  }, []);

  // Set up signature canvas drawing mouse/touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  }, []);

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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { sn: lineItems.length + 1, material_code: '', description: '', uom: 'EA', requested_qty: 0, wbs_code: '', plant_code: defaultPlant, storage_location_code: defaultLoc }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    const filtered = lineItems.filter((_, i) => i !== index);
    // Recalculate serial numbers
    const updated = filtered.map((item, i) => ({ ...item, sn: i + 1 }));
    setLineItems(updated);
  };

  const handleLineChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    
    if (field === 'material_code') {
      updated[index].material_code = value;
      // Auto-fill description & UOM based on selection
      const matched = materials.find(m => m.material_code === value);
      if (matched) {
        updated[index].description = matched.description;
        updated[index].uom = matched.uom;
      }
      fetchStockForMaterial(value);
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check canvas signature
    let signatureBase64 = '';
    const canvas = canvasRef.current;
    if (canvas) {
      // Check if signature contains drawings (not blank)
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      if (canvas.toDataURL() !== blank.toDataURL()) {
        signatureBase64 = canvas.toDataURL();
      }
    }

    if (!requestedBy) {
      alert("Requestor Name is required");
      return;
    }

    if (issueAccountType === 'project' && !selectedProj) {
      alert("Project selection is required for project-based issuance.");
      return;
    }

    if (!requestorManagerName.trim()) {
      alert("Requestor/Project Manager name is required.");
      return;
    }

    if (!requestorManagerEmail.trim()) {
      alert("Requestor/Project Manager email is required.");
      return;
    }

    if (issueAccountType === 'cost_center' && !selectedCostCenter) {
      alert("Cost center selection is required for cost center-based issuance.");
      return;
    }

    if (lineItems.some(item => !item.material_code || item.requested_qty <= 0)) {
      alert("Please ensure all line items have a valid Material Code and a quantity greater than zero.");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/mrf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date,
          requested_by_name: requestedBy,
          staff_mobile: staffMobile,
          department_id: selectedDept ? parseInt(selectedDept) : null,
          project_code: issueAccountType === 'project' ? selectedProj : null,
          issue_account_type: issueAccountType,
          cost_center_code: issueAccountType === 'cost_center' ? selectedCostCenter : null,
          requestor_manager_name: requestorManagerName,
          requestor_manager_email: requestorManagerEmail,
          project_manager_name: requestorManagerName,
          project_manager_email: requestorManagerEmail,
          requested_from_warehouse_id: selectedWarehouse ? parseInt(selectedWarehouse) : null,
          purpose,
          location,
          warehouse_poc_name: warehousePoc,
          warehouse_poc_mobile: warehousePocMobile,
          additional_poc_name: null,
          additional_poc_mobile: additionalPocMobile,
          wbs_code: null,
          reference_pr: null,
          reference_po: referencePo,
          comments,
          line_items: lineItems.map(item => ({
            sn: item.sn,
            material_code: item.material_code,
            description: item.description,
            uom: item.uom,
            requested_qty: parseFloat(item.requested_qty.toString()),
            wbs_code: issueAccountType === 'project' ? item.wbs_code : null,
            plant_code: item.plant_code,
            storage_location_code: item.storage_location_code
          })),
          requestor_signature: signatureBase64 || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit MRF.');
      }

      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving MRF.');
    }
  };

  const totalQuantity = lineItems.reduce((acc, curr) => acc + (parseFloat(curr.requested_qty?.toString()) || 0), 0);

  return (
    <div className="glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} style={{ color: 'var(--primary)' }} />
          Create Material Request Form (MRF)
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Submit Request</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Section 1: General Requestor Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Request Date</label>
            <input type="date" required className="input-field" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Requested By (Full Name)</label>
            <input type="text" required className="input-field" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} placeholder="Enter full name" />
          </div>

          <div className="form-group">
            <label className="form-label">Staff / Mobile No.</label>
            <input type="text" className="input-field" value={staffMobile} onChange={e => setStaffMobile(e.target.value)} placeholder="Mobile No." />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select required className="input-field" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">Select Department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Requestor/Project Manager Name</label>
            <input
              type="text"
              required
              className="input-field"
              value={requestorManagerName}
              onChange={e => setRequestorManagerName(e.target.value)}
              placeholder="Enter requestor/project manager name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Requestor/Project Manager Email</label>
            <input
              type="email"
              required
              className="input-field"
              value={requestorManagerEmail}
              onChange={e => setRequestorManagerEmail(e.target.value)}
              placeholder="Enter requestor/project manager email"
            />
          </div>
        </div>

        {/* Section 2: Destination Warehouses & Projects */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Issue To</label>
            <select
              className="input-field"
              value={issueAccountType}
              onChange={e => {
                const next = e.target.value as 'project' | 'cost_center';
                setIssueAccountType(next);
                if (next === 'project') {
                  setSelectedCostCenter('');
                } else {
                  setSelectedProj('');
                  setProjectManagerName('');
                  setProjectManagerEmail('');
                  setSelectedWbs('');
                  setLineItems(items => items.map(item => ({ ...item, wbs_code: '' })));
                }
              }}
            >
              <option value="project">Project</option>
              <option value="cost_center">Cost Center</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{issueAccountType === 'project' ? 'Project Code' : 'Cost Center'}</label>
            {issueAccountType === 'project' ? (
              <select
                required
                className="input-field"
                value={selectedProj}
                onChange={e => {
                  setSelectedProj(e.target.value);
                  setProjectManagerName('');
                  setProjectManagerEmail('');
                }}
              >
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                ))}
              </select>
            ) : (
              <select required className="input-field" value={selectedCostCenter} onChange={e => setSelectedCostCenter(e.target.value)}>
                <option value="">Select Cost Center</option>
                {costCenters.map(cc => (
                  <option key={cc.code} value={cc.code}>{cc.code} - {cc.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Requested From Warehouse</label>
            <select required className="input-field" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
              <option value="">Select Warehouse</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Delivery Location</label>
            <input type="text" className="input-field" value={location} onChange={e => setLocation(e.target.value)} placeholder="Site / Warehouse Location" />
          </div>
        </div>

        {/* Section 3: POC Info, Purpose, PO refs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Warehouse POC Name</label>
            <input type="text" className="input-field" value={warehousePoc} onChange={e => setWarehousePoc(e.target.value)} placeholder="POC Name" />
          </div>

          <div className="form-group">
            <label className="form-label">Warehouse POC Mobile</label>
            <input type="text" className="input-field" value={warehousePocMobile} onChange={e => setWarehousePocMobile(e.target.value)} placeholder="POC Mobile" />
          </div>

          <div className="form-group">
            <label className="form-label">Warehouse POC Phone</label>
            <input type="text" className="input-field" value={additionalPocMobile} onChange={e => setAdditionalPocMobile(e.target.value)} placeholder="Warehouse Phone Number" />
          </div>

          <div className="form-group">
            <label className="form-label">Ref PO Number</label>
            <input type="text" className="input-field" value={referencePo} onChange={e => setReferencePo(e.target.value)} placeholder="Purchase Order Ref" />
          </div>
        </div>

        {/* Section 3.5: Purpose */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Purpose / Remarks</label>
            <input type="text" className="input-field" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose of stock issuance" />
          </div>
        </div>

        {/* Section 4: Material Line Items Table */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Material Request Line Items</h3>
            <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={addLineItem}>
              <Plus size={14} />
              Add Row
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>SN</th>
                  <th style={{ width: '200px' }}>Part Number / SAP Code</th>
                  <th>Product/Service Description</th>
                  <th style={{ width: '80px' }}>UOM</th>
                  <th style={{ width: '100px' }}>Requested Qty</th>
                  <th style={{ width: '180px' }}>{issueAccountType === 'project' ? 'Line WBS Element' : 'Cost Center'}</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.sn}</td>
                    <td>
                      <SearchableMaterialSelect
                        materials={materials}
                        value={item.material_code}
                        onChange={val => handleLineChange(index, 'material_code', val)}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <input
                          type="text"
                          disabled
                          className="input-field"
                          style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.1)' }}
                          value={item.description}
                        />
                        {(() => {
                          if (!item.material_code) return null;
                          const available = stockLevels[item.material_code];
                          if (available === undefined) return null;
                          if (available === 0) {
                            return (
                              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'block', marginTop: '0.25rem', fontWeight: 600 }}>
                                ⚠️ Zero Stock. Will go for replenishment approval.
                              </span>
                            );
                          }
                          if (item.requested_qty > available) {
                            return (
                              <span style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'block', marginTop: '0.25rem', fontWeight: 600 }}>
                                ⚠️ Insufficient Stock ({available} available).
                              </span>
                            );
                          }
                          return (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', marginTop: '0.25rem', fontWeight: 500 }}>
                              ✓ Available: {available}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        disabled
                        className="input-field"
                        style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.1)' }}
                        value={item.uom}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        className="input-field"
                        style={{ width: '100%' }}
                        value={item.requested_qty || ''}
                        onChange={e => handleLineChange(index, 'requested_qty', e.target.value)}
                      />
                    </td>
                    <td>
                      {issueAccountType === 'project' ? (
                        <SearchableSelect
                          options={[
                            { value: '', label: 'Default WBS', description: 'Inherit default project WBS element' },
                            ...wbsElements
                              .filter(wbs => !selectedProj || wbs.project_code === selectedProj)
                              .map(wbs => ({ value: wbs.code, label: wbs.code, description: wbs.description }))
                          ]}
                          value={item.wbs_code}
                          onChange={val => handleLineChange(index, 'wbs_code', val)}
                          placeholder="Select WBS..."
                        />
                      ) : (
                        <input
                          type="text"
                          disabled
                          className="input-field"
                          style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.1)' }}
                          value={selectedCostCenter ? selectedCostCenter : 'N/A'}
                        />
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        onClick={() => removeLineItem(index)}
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Total Requested Qty: {totalQuantity}</span>
          </div>
        </div>

        {/* Section 5: Signature Drawing Canvas */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div className="form-group">
              <label className="form-label">Comments / Extra instructions</label>
              <textarea
                className="input-field"
                style={{ minHeight: '120px', resize: 'vertical' }}
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder="Write any comments here..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Draw Requestor Hand Signature</span>
              <button type="button" onClick={clearCanvas} style={{ border: 'none', background: 'none', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                <Eraser size={12} />
                Clear
              </button>
            </label>
            
            <div className="signature-canvas-container" style={{ height: '120px' }}>
              <canvas
                ref={canvasRef}
                width={380}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              Draw signature inside boundaries using mouse or touch pointer
            </p>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel Request
          </button>
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={16} />
            Submit MRF to Pipeline
          </button>
        </div>
      </form>
    </div>
  );
};

export default MRFForm;
