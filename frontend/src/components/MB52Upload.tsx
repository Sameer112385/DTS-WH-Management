import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import { MB52UploadHistory, Discrepancy, User } from '../types';
import ModuleDataTools from './ModuleDataTools';

interface MB52UploadProps {
  uploadHistory: MB52UploadHistory[];
  discrepancies: Discrepancy[];
  apiBase: string;
  token: string;
  onRefresh: () => void;
  user: User | null;
}

const MB52Upload: React.FC<MB52UploadProps> = ({
  uploadHistory,
  discrepancies,
  apiBase,
  token,
  onRefresh,
  user
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'discrepancies' | 'history'>('upload');
  
  // Resolve modal state
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBase}/mb52/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Upload failed.');
      }

      const data = await res.json();
      setSuccess(`MB52 report uploaded successfully! Ingested ${data.total_records} lines. Discrepancies found: ${data.discrepancies_found}`);
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById('mb52-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'File upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingId) return;

    try {
      const res = await fetch(`${apiBase}/mb52/discrepancies/${resolvingId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: resolveReason,
          responsible_person: responsiblePerson
        })
      });

      if (!res.ok) {
        throw new Error('Resolution failed.');
      }

      setResolvingId(null);
      setResolveReason('');
      setResponsiblePerson('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Resolution failed.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey="stock" onComplete={onRefresh} userRole={user?.role} />
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem' }}>
        {[
          { id: 'upload', label: 'Import SAP MB52' },
          { id: 'discrepancies', label: `Discrepancies (${discrepancies.filter(d=>d.status==='Pending').length})` },
          { id: 'history', label: 'Upload Logs' }
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

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Import Latest MB52 Report</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Upload the standard SAP MB52 Excel report. The system will automatically compare current stock balances and trigger alerts if discrepancies are found.
            </p>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--danger)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: 'var(--success)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle size={16} />
                {success}
              </div>
            )}

            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '2.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'rgba(0,0,0,0.1)'
              }} onClick={() => document.getElementById('mb52-file-input')?.click()}>
                <Upload size={36} style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  {file ? file.name : 'Click to browse Excel file'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Supports standard SAP .xlsx and .xls exports
                </p>
                <input
                  id="mb52-file-input"
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading || !file} style={{ justifyContent: 'center' }}>
                {loading ? 'Processing SAP Report...' : 'Validate and Ingest Stock'}
              </button>
            </form>
          </div>

          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Required MB52 Format Template</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              The Excel report sheet must contain the following 37 standard SAP columns as headers:
            </p>
            <div style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '0.75rem',
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.4rem'
            }}>
              {[
                "Material", "Plant", "Storage Location", "Special Stock", "Spec. stk valuation",
                "Special stock number", "DF stor. loc. level", "Base Unit of Measure", "Unrestricted",
                "Stock Segment", "Currency", "Value Unrestricted", "Transit and Transfer",
                "Val. in Trans./Tfr", "Quality Inspection", "Value in QualInsp.", "Restricted-Use Stock",
                "Value Restricted", "Blocked", "Value BlockedStock", "Returns", "Value Rets Blocked",
                "Material Description", "Name 1", "Material Type", "Material Group",
                "Descr. of Storage Loc.", "Valuated Goods Receipt Blocked Stock", "Val. GR Blocked St.",
                "Tied Empties", "Val. Tied Empties", "Stock in Transit", "Value in Transit",
                "In transfer (plant)", "Value in Stock Tfr", "Customer", "WBS Element"
              ].map((c, i) => (
                <div key={i} style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--primary)' }}>{i+1}.</span> {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discrepancies Tab */}
      {activeTab === 'discrepancies' && (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Inventory Mismatch Warnings</h3>
          
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Description</th>
                  <th>Plant/Location</th>
                  <th>WBS</th>
                  <th>Old Qty</th>
                  <th>New Qty</th>
                  <th>Diff Qty</th>
                  <th>Diff Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {discrepancies.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      All systems aligned. No stock discrepancies detected.
                    </td>
                  </tr>
                ) : (
                  discrepancies.map(disc => (
                    <tr key={disc.id}>
                      <td style={{ fontWeight: 600, color: disc.status === 'Pending' ? 'var(--danger)' : 'inherit' }}>{disc.material_code}</td>
                      <td>{disc.material_description}</td>
                      <td>{disc.plant} / {disc.storage_location}</td>
                      <td>{disc.wbs || 'N/A'}</td>
                      <td>{disc.old_qty}</td>
                      <td>{disc.new_qty}</td>
                      <td style={{ fontWeight: 600, color: disc.diff_qty > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {disc.diff_qty > 0 ? `+${disc.diff_qty}` : disc.diff_qty}
                      </td>
                      <td style={{ color: disc.diff_value > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        ${disc.diff_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`badge ${disc.status === 'Resolved' ? 'badge-success' : 'badge-danger'}`}>
                          {disc.status}
                        </span>
                      </td>
                      <td>
                        {disc.status === 'Pending' ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setResolvingId(disc.id)}
                          >
                            Resolve Alert
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Resolved by {disc.responsible_person}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Log Tab */}
      {activeTab === 'history' && (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>MB52 Upload History Ledger</h3>
          
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Filename</th>
                  <th>Uploaded By</th>
                  <th>Date / Time</th>
                  <th>Total Rows</th>
                  <th>Discrepancies Detected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {uploadHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No uploads registered yet.
                    </td>
                  </tr>
                ) : (
                  uploadHistory.map(h => (
                    <tr key={h.id}>
                      <td>#{h.id}</td>
                      <td style={{ fontWeight: 550 }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={16} />{h.filename}</div></td>
                      <td>{h.uploaded_by}</td>
                      <td>{new Date(h.uploaded_at).toLocaleString()}</td>
                      <td>{h.total_records}</td>
                      <td style={{ fontWeight: 600, color: h.discrepancies_found > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {h.discrepancies_found}
                      </td>
                      <td>
                        <span className="badge badge-success">{h.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve Discrepancy Modal */}
      {resolvingId !== null && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert style={{ color: 'var(--danger)' }} />
              Resolve Inventory Discrepancy #{resolvingId}
            </h3>

            <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Responsible Person / Auditor</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={responsiblePerson}
                  onChange={e => setResponsiblePerson(e.target.value)}
                  placeholder="e.g. Supervisor Name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Auditing Action / Reason</label>
                <textarea
                  required
                  className="input-field"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={resolveReason}
                  onChange={e => setResolveReason(e.target.value)}
                  placeholder="Provide audit reason, stock correction details, physical count verification details, etc."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResolvingId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MB52Upload;
