import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, Trash, CheckCircle } from 'lucide-react';
import { Material, Plant, StorageLocation, WbsElement, MaterialTransfer, User } from '../types';
import SearchableMaterialSelect from './SearchableMaterialSelect';
import SearchableSelect from './SearchableSelect';
import ModuleDataTools from './ModuleDataTools';

interface TransferProps {
  apiBase: string;
  token: string;
  plants: Plant[];
  storageLocations: StorageLocation[];
  wbsElements: WbsElement[];
  transfers: MaterialTransfer[];
  user: User | null;
  onRefresh: () => void;
}

interface TransferLine {
  material_code: string;
  quantity: number;
}

const TransferModule: React.FC<TransferProps> = ({
  apiBase,
  token,
  plants,
  storageLocations,
  wbsElements,
  transfers,
  user,
  onRefresh
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Form States
  const [sourcePlant, setSourcePlant] = useState('PL01');
  const [sourceLoc, setSourceLoc] = useState('SL01');
  const [sourceWbs, setSourceWbs] = useState('');
  
  const [destPlant, setDestPlant] = useState('PL01');
  const [destLoc, setDestLoc] = useState('SL01');
  const [destWbs, setDestWbs] = useState('');
  const [remarks, setRemarks] = useState('');
  
  const [lines, setLines] = useState<TransferLine[]>([
    { material_code: '', quantity: 0 }
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
    setLines([...lines, { material_code: '', quantity: 0 }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (index: number, field: keyof TransferLine, value: any) => {
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
      const res = await fetch(`${apiBase}/transfer/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          source_plant: sourcePlant,
          source_storage_location: sourceLoc,
          source_wbs: sourceWbs || null,
          dest_plant: destPlant,
          dest_storage_location: destLoc,
          dest_wbs: destWbs || null,
          remarks,
          line_items: lines.map(l => ({
            material_code: l.material_code,
            quantity: parseFloat(l.quantity.toString())
          }))
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit transfer request.');
      }

      setRemarks('');
      setLines([{ material_code: '', quantity: 0 }]);
      setActiveTab('history');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving transfer.');
    }
  };

  const handleApprove = async (transferId: number) => {
    try {
      const res = await fetch(`${apiBase}/transfer/${transferId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to approve transfer.');
      }

      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleDownloadPdf = (transferId: number) => {
    window.open(`${apiBase}/transfer/${transferId}/pdf?token=${token}`, '_blank');
  };

  const canUserApproveTransfers = user && ['Admin', 'Warehouse Manager', 'Warehouse Supervisor'].includes(user.role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey="transfer" onComplete={onRefresh} userRole={user?.role} />
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem' }}>
        {[
          { id: 'create', label: 'Create Stock Transfer' },
          { id: 'history', label: 'Transfer Log History' }
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
            <ArrowLeftRight size={18} style={{ color: 'var(--primary)' }} />
            Internal Stock Transfer Request
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Source vs Destination Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              {/* Source Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>Source Location Parameters</h4>
                
                <div className="form-group">
                  <label className="form-label">Source Plant</label>
                  <SearchableSelect
                    options={plants.map(p => ({ value: p.code, label: p.code, description: p.name }))}
                    value={sourcePlant}
                    onChange={setSourcePlant}
                    placeholder="Select Source Plant..."
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Source Storage Location</label>
                  <SearchableSelect
                    options={storageLocations
                      .filter(loc => loc.plant_code === sourcePlant)
                      .map(loc => ({ value: loc.code, label: loc.code, description: loc.name }))}
                    value={sourceLoc}
                    onChange={setSourceLoc}
                    placeholder="Select Source Loc..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Source WBS Element (Optional)</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'No WBS', description: 'Clear WBS selection' },
                      ...wbsElements.map(wbs => ({ value: wbs.code, label: wbs.code, description: wbs.description }))
                    ]}
                    value={sourceWbs}
                    onChange={setSourceWbs}
                    placeholder="Select Source WBS..."
                  />
                </div>
              </div>

              {/* Destination Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--info)' }}>Destination Location Parameters</h4>
                
                <div className="form-group">
                  <label className="form-label">Destination Plant</label>
                  <SearchableSelect
                    options={plants.map(p => ({ value: p.code, label: p.code, description: p.name }))}
                    value={destPlant}
                    onChange={setDestPlant}
                    placeholder="Select Destination Plant..."
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Destination Storage Location</label>
                  <SearchableSelect
                    options={storageLocations
                      .filter(loc => loc.plant_code === destPlant)
                      .map(loc => ({ value: loc.code, label: loc.code, description: loc.name }))}
                    value={destLoc}
                    onChange={setDestLoc}
                    placeholder="Select Destination Loc..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Destination WBS Element (Optional)</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'No WBS', description: 'Clear WBS selection' },
                      ...wbsElements.map(wbs => ({ value: wbs.code, label: wbs.code, description: wbs.description }))
                    ]}
                    value={destWbs}
                    onChange={setDestWbs}
                    placeholder="Select Destination WBS..."
                  />
                </div>
              </div>

            </div>

            {/* Line items table */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 650 }}>Transfer Items List</h4>
                <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={addLine}>
                  <Plus size={14} />
                  Add Row
                </button>
              </div>

              <div className="table-container">
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th style={{ width: '250px' }}>Quantity to Transfer</th>
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
              <label className="form-label">Transfer Remarks</label>
              <textarea className="input-field" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="State reason or notes for this stock transfer..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={16} />
                Submit Transfer Request
              </button>
            </div>

          </form>
        </div>
      ) : (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Stock Transfer Logs</h3>
          
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Transfer No</th>
                  <th>Source Loc</th>
                  <th>Dest Loc</th>
                  <th>Requested By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map(tr => (
                    <tr key={tr.id}>
                      <td style={{ fontWeight: 600 }}>{tr.transfer_number}</td>
                      <td>{tr.source_plant}/{tr.source_storage_location} {tr.source_wbs && `(WBS: ${tr.source_wbs})`}</td>
                      <td>{tr.dest_plant}/{tr.dest_storage_location} {tr.dest_wbs && `(WBS: ${tr.dest_wbs})`}</td>
                      <td>{tr.requested_by}</td>
                      <td>{new Date(tr.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${tr.status === 'Transferred' ? 'badge-success' : tr.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                          {tr.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {tr.status === 'Pending Approval' && canUserApproveTransfers && (
                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleApprove(tr.id)}>
                              Approve Release
                            </button>
                          )}
                          {tr.status === 'Transferred' && (
                            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleDownloadPdf(tr.id)}>
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
      )}

    </div>
  );
};

export default TransferModule;
