import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';

interface ModuleDataToolsProps {
  apiBase: string;
  token: string;
  moduleKey: string;
  title?: string;
  onComplete?: () => void;
  allowImport?: boolean;
  userRole?: string | null;
}

const ModuleDataTools: React.FC<ModuleDataToolsProps> = ({
  apiBase,
  token,
  moduleKey,
  title,
  onComplete,
  allowImport = true,
  userRole
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const canUseTools = ['Admin', 'Warehouse Manager', 'Warehouse Supervisor'].includes(userRole || '');

  if (!canUseTools) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/admin-tools/export/${moduleKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Export failed.');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${moduleKey}-export.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/admin-tools/template/${moduleKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Template download failed.');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${moduleKey}-template.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert(err.message || 'Template download failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiBase}/admin-tools/import/${moduleKey}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Import failed.');
      alert(data.message || 'Import completed.');
      onComplete?.();
    } catch (err: any) {
      alert(err.message || 'Import failed.');
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {title && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{title}</span>}
      <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Download size={14} />
        Export
      </button>
      {allowImport && (
        <>
          <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Download size={14} />
            Template
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleImportClick} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Upload size={14} />
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
        </>
      )}
    </div>
  );
};

export default ModuleDataTools;
