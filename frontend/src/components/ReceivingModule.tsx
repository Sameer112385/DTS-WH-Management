import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash, CheckCircle } from 'lucide-react';
import { Material, Plant, StorageLocation, WbsElement, MaterialReceiving, User } from '../types';
import SearchableMaterialSelect from './SearchableMaterialSelect';
import SearchableSelect from './SearchableSelect';
import ModuleDataTools from './ModuleDataTools';

interface ReceivingProps {
  apiBase: string;
  token: string;
  plants: Plant[];
  storageLocations: StorageLocation[];
  wbsElements: WbsElement[];
  receivings: MaterialReceiving[];
  onRefresh: () => void;
  user: User | null;
}

interface ItemLine {
  material_code: string;
  plant_code: string;
  storage_location_code: string;
  wbs_code: string;
  quantity: number;
  remarks: string;
}

const ReceivingModule: React.FC<ReceivingProps> = ({
  apiBase,
  token,
  plants,
  storageLocations,
  wbsElements,
  receivings,
  onRefresh,
  user
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Creation States
  const [type, setType] = useState('PO');
  const [supplier, setSupplier] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  
  const [lines, setLines] = useState<ItemLine[]>([
    { material_code: '', plant_code: 'PL01', storage_location_code: 'SL01', wbs_code: '', quantity: 0, remarks: '' }
  ]);

  useEffect(() => {
    fetch(`${apiBase}/materials/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMaterials(data))
      .catch(err => console.error(err));
  }, []);

  const addLine = () => {
    setLines([
      ...lines,
      { material_code: '', plant_code: 'PL01', storage_location_code: 'SL01', wbs_code: '', quantity: 0, remarks: '' }
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof ItemLine, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (lines.some(l => !l.material_code || l.quantity <= 0)) {
      alert("Please ensure all items have a valid Material Code and a positive quantity.");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/receiving/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          supplier,
          reference_number: referenceNumber,
          received_date: receivedDate,
          remarks,
          line_items: lines.map(l => ({
            material_code: l.material_code,
            plant_code: l.plant_code,
            storage_location_code: l.storage_location_code,
            wbs_code: l.wbs_code || null,
            quantity: parseFloat(l.quantity.toString()),
            remarks: l.remarks
          }))
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit receiving form.');
      }

      setSupplier('');
      setReferenceNumber('');
      setRemarks('');
      setLines([{ material_code: '', plant_code: 'PL01', storage_location_code: 'SL01', wbs_code: '', quantity: 0, remarks: '' }]);
      setActiveTab('history');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving receiving form.');
    }
  };

  const handleDownloadPdf = (recId: number) => {
    window.open(`${apiBase}/receiving/${recId}/pdf?token=${token}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey="receiving" onComplete={onRefresh} userRole={user?.role} />
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem' }}>
        {[
          { id: 'create', label: 'Ingest Material Receiving' },
          { id: 'history', label: 'Receiving Log History' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              paddingBottom: '0.75rem',
              background: 'none',
              border: 'none',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: '0.95rem'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'create' ? (
        <div className="glass" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} style={{ color: 'var(--primary)' }} />
            Receive Stock Ingestion ticket
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              
              <div className="form-group">
                <label className="form-label">Receiving Type</label>
                <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
                  <option value="PO">Purchase Order (PO)</option>
                  <option value="Delivery Note">Delivery Note (DN)</option>
                  <option value="Manual">Manual Ingestion</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Supplier Name</label>
                <input type="text" className="input-field" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier Company Name" />
              </div>

              <div className="form-group">
                <label className="form-label">PO / Delivery Note Reference No</label>
                <input type="text" required className="input-field" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g. PO-771804" />
              </div>

              <div className="form-group">
                <label className="form-label">Received Date</label>
                <input type="date" required className="input-field" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
              </div>
            </div>

            {/* Line items table */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 650 }}>Items Ingest List</h4>
                <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={addLine}>
                  <Plus size={14} />
                  Add Row
                </button>
              </div>

              <div className="table-container">
                <table className="custom-table" style={{ width: '100%', minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '220px' }}>Material Code</th>
                      <th style={{ width: '130px' }}>Plant</th>
                      <th style={{ width: '130px' }}>Storage Location</th>
                      <th style={{ width: '180px' }}>WBS Element</th>
                      <th style={{ width: '120px' }}>Quantity</th>
                      <th>Remarks</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <SearchableMaterialSelect
                            materials={materials}
                            value={line.material_code}
                            onChange={val => handleLineChange(idx, 'material_code', val)}
                          />
                        </td>
                        <td>
                          <SearchableSelect
                            options={plants.map(p => ({ value: p.code, label: p.code, description: p.name }))}
                            value={line.plant_code}
                            onChange={val => handleLineChange(idx, 'plant_code', val)}
                            placeholder="Select Plant..."
                          />
                        </td>
                        <td>
                          <SearchableSelect
                            options={storageLocations
                              .filter(loc => loc.plant_code === line.plant_code)
                              .map(loc => ({ value: loc.code, label: loc.code, description: loc.name }))}
                            value={line.storage_location_code}
                            onChange={val => handleLineChange(idx, 'storage_location_code', val)}
                            placeholder="Select Loc..."
                          />
                        </td>
                        <td>
                          <SearchableSelect
                            options={[
                              { value: '', label: 'No WBS', description: 'Clear WBS selection' },
                              ...wbsElements.map(wbs => ({ value: wbs.code, label: wbs.code, description: wbs.description }))
                            ]}
                            value={line.wbs_code}
                            onChange={val => handleLineChange(idx, 'wbs_code', val)}
                            placeholder="Select WBS..."
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
                            value={line.quantity || ''}
                            onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input-field"
                            style={{ width: '100%' }}
                            value={line.remarks}
                            onChange={e => handleLineChange(idx, 'remarks', e.target.value)}
                            placeholder="Condition notes"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            onClick={() => removeLine(idx)}
                          >
                            <Trash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <label className="form-label">General Remarks</label>
              <textarea className="input-field" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="General comments about this ingestion shipment..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={16} />
                Ingest Stock & Generate Form
              </button>
            </div>

          </form>
        </div>
      ) : (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Received Shipments Log</h3>
          
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Receiving Number</th>
                  <th>Type</th>
                  <th>Supplier</th>
                  <th>Reference</th>
                  <th>Received By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {receivings.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No received items recorded yet.
                    </td>
                  </tr>
                ) : (
                  receivings.map(rec => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600 }}>{rec.receiving_number}</td>
                      <td>{rec.type}</td>
                      <td>{rec.supplier || 'N/A'}</td>
                      <td>{rec.reference_number || 'N/A'}</td>
                      <td>{rec.received_by}</td>
                      <td>{rec.received_date}</td>
                      <td>
                        <span className={`badge ${rec.status === 'Received' ? 'badge-success' : 'badge-danger'}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleDownloadPdf(rec.id)}>
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReceivingModule;
