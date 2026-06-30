import React from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { User, Discrepancy } from '../types';

interface HeaderProps {
  currentView: string;
  user: User | null;
  discrepancies: Discrepancy[];
  onAlertClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, user, discrepancies, onAlertClick }) => {
  const getTitle = () => {
    switch(currentView) {
      case 'dashboard': return 'Command Center Dashboard';
      case 'mb52': return 'SAP MB52 Upload & Discrepancies';
      case 'catalog': return 'Material Catalog & Registry';
      case 'materials': return 'Stock Overview & Inventory Ledger';
      case 'mrf': return 'Material Request Forms (MRF)';
      case 'receiving': return 'Material Receiving (PO / Delivery Note)';
      case 'transfer': return 'Material Transfer & Movements';
      case 'reports': return 'Reports, Logs & Analytics';
      case 'company': return 'Company Profile & Organizational Setup';
      case 'settings': return 'System Settings & Integrations';
      default: return 'Warehouse ERP';
    }
  };

  const pendingAlerts = discrepancies.filter(d => d.status === 'Pending').length;

  return (
    <header className="glass" style={{
      height: 'var(--header-height)',
      position: 'fixed',
      top: 0,
      left: 'var(--sidebar-width)',
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      borderRadius: '0',
      borderBottom: '1px solid var(--border-color)',
      zIndex: 90
    }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, background: 'linear-gradient(135deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {getTitle()}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Discrepancy quick alert status */}
        {pendingAlerts > 0 && (
          <button 
            onClick={onAlertClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--danger)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              cursor: 'pointer',
              animation: 'pulse 2s infinite'
            }}
          >
            <AlertTriangle size={14} />
            {pendingAlerts} Stock Mismatches
          </button>
        )}

        {/* Alerts Bell Icon */}
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={onAlertClick}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.02)'
          }}>
            <Bell size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {pendingAlerts > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: 'var(--danger)',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px var(--danger)'
            }}>
              {pendingAlerts}
            </span>
          )}
        </div>

        {/* Date view */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </header>
  );
};

export default Header;
