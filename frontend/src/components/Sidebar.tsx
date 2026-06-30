import React from 'react';
import { 
  LayoutDashboard, FileSpreadsheet, Box, FileText, 
  Download, ArrowLeftRight, FileBarChart, Settings, 
  Building2, LogOut, Moon, Sun, UserCheck, ClipboardList
} from 'lucide-react';
import { User, CompanySetting } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  user: User | null;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
  companySetting: CompanySetting | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  user,
  onLogout,
  theme,
  toggleTheme,
  companySetting
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['*'] },
    { id: 'mb52', label: 'MB52 Upload', icon: FileSpreadsheet, roles: ['Admin', 'Warehouse Manager', 'Warehouse Supervisor'] },
    { id: 'catalog', label: 'Material Catalog', icon: ClipboardList, roles: ['Admin', 'Warehouse Manager', 'Warehouse Supervisor'] },
    { id: 'materials', label: 'Stock Overview', icon: Box, roles: ['*'] },
    { id: 'mrf', label: 'Material Requests', icon: FileText, roles: ['*'] },
    { id: 'receiving', label: 'Material Receiving', icon: Download, roles: ['Admin', 'Warehouse Manager', 'Warehouse Supervisor', 'Warehouse Worker'] },
    { id: 'transfer', label: 'Material Transfer', icon: ArrowLeftRight, roles: ['Admin', 'Warehouse Manager', 'Warehouse Supervisor', 'Warehouse Worker'] },
    { id: 'reports', label: 'Reports & Audits', icon: FileBarChart, roles: ['*'] },
    { id: 'company', label: 'Company Setup', icon: Building2, roles: ['Admin', 'Warehouse Manager', 'Warehouse Supervisor'] },
    { id: 'settings', label: 'System Settings', icon: Settings, roles: ['Admin', 'Warehouse Manager'] },
  ];

  const filteredMenu = menuItems.filter(item => {
    if (item.roles.includes('*')) return true;
    return user && (user.role === 'Admin' || item.roles.includes(user.role));
  });

  return (
    <aside className="glass" style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '0',
      borderRight: '1px solid var(--border-color)',
      zIndex: 100
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        {companySetting?.company_logo ? (
          <img 
            src={companySetting.company_logo} 
            alt={companySetting.company_name} 
            style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} 
          />
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), #818cf8)',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
          }}>
            {(companySetting?.company_name || 'W').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
            {companySetting?.company_name || 'WAREHOUSE'}
          </h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
            {companySetting?.location || 'Operations ERP'}
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flexGrow: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
        {filteredMenu.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'var(--primary-glow)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.925rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease'
              }}
              className={!isActive ? 'glass-interactive' : ''}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Info Block */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(0, 0, 0, 0.15)'
      }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <UserCheck size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user.role}</p>
            </div>
          </div>
        )}

        {/* Theme and Logout Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={toggleTheme}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%'
            }}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button 
            onClick={onLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--danger)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-heading)'
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
