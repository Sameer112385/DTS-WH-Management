import React from 'react';
import { 
  DollarSign, Package, AlertTriangle, Clock, 
  ArrowUpRight, RefreshCcw, EyeOff, ClipboardList 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

interface DashboardProps {
  metrics: {
    total_materials: number;
    total_stock_value: number;
    low_stock_items: number;
    zero_stock_items: number;
    blocked_stock_qty: number;
    quality_inspection_qty: number;
    transit_stock_qty: number;
    pending_mrfs: number;
    pending_receivings: number;
    pending_transfers: number;
    discrepancy_alerts: number;
    cancelled_transactions: number;
    recent_mrfs: any[];
    recent_discrepancies: any[];
  } | null;
  onRefresh: () => void;
  setCurrentView: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ metrics, onRefresh, setCurrentView }) => {
  if (!metrics) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading system dashboard metrics...</p>
      </div>
    );
  }

  // Use real data from backend if available, fallback to mock data
  const chartData = (metrics && (metrics as any).chart_data) || [
    { name: 'Jan', Issuances: 400, Transfers: 240, Receivings: 500 },
    { name: 'Feb', Issuances: 300, Transfers: 139, Receivings: 430 },
    { name: 'Mar', Issuances: 200, Transfers: 980, Receivings: 600 },
    { name: 'Apr', Issuances: 278, Transfers: 390, Receivings: 400 },
    { name: 'May', Issuances: 189, Transfers: 480, Receivings: 320 },
    { name: 'Jun', Issuances: 239, Transfers: 380, Receivings: 480 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header and Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time warehouse operational performance overview</p>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCcw size={14} />
          Sync Ledger
        </button>
      </div>

      {/* KPI Metrics row 1 */}
      <div className="metrics-grid">
        <div className="glass metric-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="metric-details">
            <p>Total Stock Value</p>
            <h3>${metrics.total_stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <DollarSign size={22} />
          </div>
        </div>

        <div className="glass metric-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="metric-details">
            <p>Material Codes</p>
            <h3>{metrics.total_materials}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--info)' }}>
            <Package size={22} />
          </div>
        </div>

        <div className="glass metric-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="metric-details">
            <p>Low Stock Items</p>
            <h3>{metrics.low_stock_items}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="glass metric-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="metric-details">
            <p>Discrepancies</p>
            <h3>{metrics.discrepancy_alerts}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
            <AlertTriangle size={22} style={{ color: 'var(--danger)' }} />
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Blocked Stock', value: metrics.blocked_stock_qty, color: 'var(--danger)' },
          { label: 'Quality Insp.', value: metrics.quality_inspection_qty, color: 'var(--warning)' },
          { label: 'In Transit', value: metrics.transit_stock_qty, color: 'var(--info)' },
          { label: 'Zero Stock Codes', value: metrics.zero_stock_items, color: 'var(--text-muted)' },
          { label: 'Pending MRFs', value: metrics.pending_mrfs, color: 'var(--primary)' },
          { label: 'Cancelled Trans', value: metrics.cancelled_transactions, color: 'var(--danger)' },
        ].map((item, idx) => (
          <div key={idx} className="glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid-2col">
        {/* Issuances Area Chart */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Material Movements Trend (Monthly)</h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIssuances" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }} />
                <Area type="monotone" dataKey="Issuances" stroke="var(--primary)" fillOpacity={1} fill="url(#colorIssuances)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action comparison charts */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Activity Logs (Receiving vs Transfers)</h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }} />
                <Bar dataKey="Receivings" fill="var(--info)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Transfers" fill="var(--warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recents Lists Row */}
      <div className="grid-2col">
        {/* Pending approvals MRF list */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Recent Material Requests</h3>
            <button 
              onClick={() => setCurrentView('mrf')}
              style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              Manage Requests
              <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.recent_mrfs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent MRF records found.</p>
            ) : (
              metrics.recent_mrfs.map((m, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.ref}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      By {m.requested_by} • Qty: {m.qty} items
                    </div>
                  </div>
                  <span className={`badge ${
                    m.status === 'Issued' ? 'badge-success' :
                    m.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {m.status.replace('Pending ', '')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Discrepancy details */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Recent Stock Mismatches</h3>
            <button 
              onClick={() => setCurrentView('mb52')}
              style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              Analyze Uploads
              <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.recent_discrepancies.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending discrepancy alerts.</p>
            ) : (
              metrics.recent_discrepancies.map((d, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.03)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--danger)' }}>{d.material_code}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Plt: {d.plant} • Loc: {d.storage_location} • System: {d.old_qty} vs SAP: {d.new_qty}
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, color: d.diff_qty > 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem' }}>
                    {d.diff_qty > 0 ? `+${d.diff_qty}` : d.diff_qty}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
