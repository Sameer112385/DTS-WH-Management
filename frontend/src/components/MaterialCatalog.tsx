import React, { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2, Search, X, Save, AlertCircle } from 'lucide-react';
import { Material } from '../types';
import ModuleDataTools from './ModuleDataTools';

interface MaterialCatalogProps {
  apiBase: string;
  token: string;
  onRefresh?: () => void;
  userRole?: string | null;
}

interface MaterialForm {
  material_code: string;
  description: string;
  uom: string;
  material_type: string;
  material_group: string;
}

const EMPTY_FORM: MaterialForm = {
  material_code: '',
  description: '',
  uom: '',
  material_type: '',
  material_group: ''
};

const UOM_OPTIONS = [
  'EA', 'PCS', 'M', 'KG', 'L', 'SET', 'BOX', 'ROLL', 'PAIR', 'UNIT',
  'FT', 'IN', 'CM', 'MM', 'TON', 'GAL', 'BAG', 'DRUM', 'SPOOL', 'SHEET'
];

const MaterialCatalog: React.FC<MaterialCatalogProps> = ({ apiBase, token, onRefresh, userRole }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<MaterialForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/materials/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Failed to fetch materials', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const filtered = materials.filter(m =>
    m.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.material_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.material_group || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (mat: Material) => {
    setForm({
      material_code: mat.material_code,
      description: mat.description,
      uom: mat.uom,
      material_type: mat.material_type || '',
      material_group: mat.material_group || ''
    });
    setIsEditing(true);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.material_code.trim() || !form.description.trim() || !form.uom.trim()) {
      setError('Material Code, Description, and UOM are required.');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `${apiBase}/materials/${encodeURIComponent(form.material_code)}`
        : `${apiBase}/materials/`;

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          material_code: form.material_code.trim(),
          description: form.description.trim(),
          uom: form.uom.trim(),
          material_type: form.material_type.trim() || null,
          material_group: form.material_group.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save material.');
      }

      setShowModal(false);
      fetchMaterials();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/materials/${encodeURIComponent(deleteTarget)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete material.');
      }

      setDeleteTarget(null);
      fetchMaterials();
    } catch (err: any) {
      alert(err.message || 'An error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey="materials" onComplete={() => { fetchMaterials(); onRefresh?.(); }} userRole={userRole} />
      </div>

      {/* Header bar */}
      <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px', maxWidth: '500px' }}>
          <input
            type="text"
            className="input-field"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search by code, description, type, group..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {filtered.length} material{filtered.length !== 1 ? 's' : ''} registered
          </span>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={openCreateModal}
          >
            <Plus size={16} />
            New Material
          </button>
        </div>
      </div>

      {/* Materials table */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} style={{ color: 'var(--primary)' }} />
            Material Catalog Registry
          </h3>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Material Code</th>
                <th>Description</th>
                <th style={{ width: '80px' }}>UOM</th>
                <th style={{ width: '150px' }}>Type</th>
                <th style={{ width: '150px' }}>Group</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    Loading material catalog...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    {searchTerm
                      ? 'No materials match your search.'
                      : 'No materials registered yet. Click "New Material" to add one.'}
                  </td>
                </tr>
              ) : (
                filtered.map(mat => (
                  <tr key={mat.material_code}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{mat.material_code}</td>
                    <td>{mat.description}</td>
                    <td>
                      <span className="badge badge-info">{mat.uom}</span>
                    </td>
                    <td style={{ color: mat.material_type ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {mat.material_type || '—'}
                    </td>
                    <td style={{ color: mat.material_group ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {mat.material_group || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => openEditModal(mat)}
                          title="Edit material"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setDeleteTarget(mat.material_code)}
                          title="Delete material"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="glass modal-content" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isEditing ? <Pencil size={20} style={{ color: 'var(--primary)' }} /> : <Plus size={20} style={{ color: 'var(--primary)' }} />}
                {isEditing ? 'Edit Material' : 'Register New Material'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-glow)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Material Code *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={form.material_code}
                  onChange={e => setForm({ ...form, material_code: e.target.value })}
                  placeholder="e.g. 2000000575 or MAT-CABLE-01"
                  disabled={isEditing}
                  style={{ opacity: isEditing ? 0.6 : 1 }}
                />
                {isEditing && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Material code cannot be changed after creation.
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  required
                  className="input-field"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Full material description"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit of Measure (UOM) *</label>
                  <select
                    required
                    className="input-field"
                    value={form.uom}
                    onChange={e => setForm({ ...form, uom: e.target.value })}
                  >
                    <option value="">Select UOM</option>
                    {UOM_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Material Type</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.material_type}
                    onChange={e => setForm({ ...form, material_type: e.target.value })}
                    placeholder="e.g. ROH, FERT, HALB"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Material Group</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.material_group}
                  onChange={e => setForm({ ...form, material_group: e.target.value })}
                  placeholder="e.g. Cables, Connectors, PPE"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Save size={16} />
                  {saving ? 'Saving...' : isEditing ? 'Update Material' : 'Register Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="glass modal-content" style={{ maxWidth: '420px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--danger-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Trash2 size={24} style={{ color: 'var(--danger)' }} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Delete Material?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Are you sure you want to delete <strong style={{ color: 'var(--primary)' }}>{deleteTarget}</strong>?
                This action cannot be undone.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Materials with existing stock or transaction history cannot be deleted.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialCatalog;
