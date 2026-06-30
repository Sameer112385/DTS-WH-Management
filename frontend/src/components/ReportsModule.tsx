import React, { useState, useEffect } from 'react';
import { FileBarChart, Clock, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import { AuditTrail, Cancellation, Stock, User } from '../types';
import ModuleDataTools from './ModuleDataTools';

interface ReportsProps {
  apiBase: string;
  token: string;
  auditLogs: AuditTrail[];
  cancellations: Cancellation[];
  onRefresh: () => void;
  user: User | null;
}

const ReportsModule: React.FC<ReportsProps> = ({
  apiBase,
  token,
  auditLogs,
  cancellations,
  onRefresh,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'ledger' | 'cancellations' | 'stock'>('audit');
  const [stockReport, setStockReport] = useState<Stock[]>([]);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [materialFilter, setMaterialFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickDateFilter, setQuickDateFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const fetchStockReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/materials/stock/search`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stock reports.');
      const data = await res.json();
      setStockReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      let url = `${apiBase}/reports/inventory-ledger?`;
      if (materialFilter) url += `material_code=${encodeURIComponent(materialFilter)}&`;
      if (txTypeFilter) url += `tx_type=${encodeURIComponent(txTypeFilter)}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch ledger details');
      const data = await res.json();
      setLedgerData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyQuickDateFilter = (filter: string) => {
    setQuickDateFilter(filter);
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    if (filter === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (filter === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (filter === 'week') {
      const prev = new Date();
      prev.setDate(today.getDate() - 7);
      setStartDate(formatDate(prev));
      setEndDate(formatDate(today));
    } else if (filter === 'month') {
      const prev = new Date();
      prev.setDate(today.getDate() - 30);
      setStartDate(formatDate(prev));
      setEndDate(formatDate(today));
    } else if (filter === 'year') {
      const prev = new Date();
      prev.setDate(today.getDate() - 365);
      setStartDate(formatDate(prev));
      setEndDate(formatDate(today));
    }
  };

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStockReport();
    } else if (activeTab === 'ledger') {
      fetchLedger();
    }
  }, [activeTab, materialFilter, txTypeFilter, startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey="all" onComplete={onRefresh} userRole={user?.role} />
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'audit', label: 'System Audit Trail' },
          { id: 'ledger', label: 'Material Transactions Ledger' },
          { id: 'cancellations', label: 'Cancelled Transactions' },
          { id: 'stock', label: 'Stock Valuation Report' }
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
              fontSize: '0.95rem',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>System Activity Audit Trail</h3>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={onRefresh}>
              <RefreshCw size={12} />
              Refresh Logs
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No audit trails logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>#{log.id}</td>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{log.username}</td>
                      <td>
                        <span className={`badge ${
                          log.action.includes('Cancel') || log.action.includes('Reject') ? 'badge-danger' :
                          log.action.includes('Approve') || log.action.includes('Receive') || log.action.includes('Issue') ? 'badge-success' : 'badge-info'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.remarks}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancellations Tab */}
      {activeTab === 'cancellations' && (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)' }}>
            <AlertTriangle size={18} />
            Cancellation Control Registry
          </h3>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Tx Type</th>
                  <th>Ref Number</th>
                  <th>Cancelled By</th>
                  <th>Cancellation Date</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {cancellations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No cancelled transactions in registry history.
                    </td>
                  </tr>
                ) : (
                  cancellations.map(c => (
                    <tr key={c.id}>
                      <td>#{c.id}</td>
                      <td style={{ fontWeight: 600 }}>{c.transaction_type}</td>
                      <td style={{ fontWeight: 550 }}>{c.original_ref_number}</td>
                      <td>{c.cancelled_by}</td>
                      <td>{new Date(c.cancelled_at).toLocaleString()}</td>
                      <td style={{ color: 'var(--danger)', fontStyle: 'italic' }}>{c.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Material Transactions & Stock Ledger</h3>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchLedger}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
              Refresh Ledger
            </button>
          </div>

          {/* Filters Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'rgba(0, 0, 0, 0.15)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Search Material</label>
              <input
                type="text"
                className="input-field"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                placeholder="Code or Description..."
                value={materialFilter}
                onChange={e => setMaterialFilter(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Transaction Type</label>
              <select
                className="input-field"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                value={txTypeFilter}
                onChange={e => setTxTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Receiving">Receiving (Inflow)</option>
                <option value="Issuance">Issuance (Outflow)</option>
                <option value="Transfer In">Transfer In</option>
                <option value="Transfer Out">Transfer Out</option>
                <option value="Stock Adjustment">Stock Adjustment</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Quick Date Filter</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {['all', 'today', 'week', 'month', 'year'].map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => applyQuickDateFilter(filter)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.25rem',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      background: quickDateFilter === filter ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: quickDateFilter === filter ? '#fff' : 'var(--text-main)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      fontWeight: quickDateFilter === filter ? 600 : 400
                    }}
                  >
                    {filter === 'all' ? 'All' : filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Start Date</label>
              <input
                type="date"
                className="input-field"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setQuickDateFilter('custom'); }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>End Date</label>
              <input
                type="date"
                className="input-field"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setQuickDateFilter('custom'); }}
              />
            </div>

          </div>

          {/* Table */}
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material Code</th>
                  <th>Description</th>
                  <th>Tx Type</th>
                  <th>Reference</th>
                  <th>Plant/Sloc/WBS</th>
                  <th style={{ textAlign: 'right' }}>Previous Stock</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                  <th style={{ textAlign: 'right' }}>Running Stock</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Loading ledger entries...
                    </td>
                  </tr>
                ) : ledgerData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No ledger transactions found matching active filters.
                    </td>
                  </tr>
                ) : (
                  ledgerData.map((tx, idx) => {
                    const isPositive = tx.change_qty > 0;
                    return (
                      <tr key={idx}>
                        <td>{tx.date}</td>
                        <td style={{ fontWeight: 600 }}>{tx.material_code}</td>
                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>
                          {tx.description}
                        </td>
                        <td>
                          <span className={`badge ${
                            tx.tx_type === 'Receiving' || tx.tx_type === 'Transfer In' ? 'badge-success' :
                            tx.tx_type === 'Issuance' || tx.tx_type === 'Transfer Out' ? 'badge-danger' : 'badge-info'
                          }`}>
                            {tx.tx_type}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{tx.reference}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {tx.plant_code}/{tx.storage_location_code}{tx.wbs_code ? ` / ${tx.wbs_code}` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{tx.prev_qty}</td>
                        <td style={{ textAlign: 'right', fontWeight: 650, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                          {isPositive ? `+${tx.change_qty}` : tx.change_qty}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 650, color: 'var(--primary)' }}>{tx.new_qty}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Report Tab */}
      {activeTab === 'stock' && (
        <div className="glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Stock Value & Quantity Audit Report</h3>
          
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Description</th>
                  <th>UOM</th>
                  <th>Plant / Loc</th>
                  <th>WBS Code</th>
                  <th>Stock Available</th>
                  <th>Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Generating reports...
                    </td>
                  </tr>
                ) : stockReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  stockReport.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.material_code}</td>
                      <td>{item.description}</td>
                      <td>{item.uom || 'EA'}</td>
                      <td>{item.plant_code} / {item.storage_location_code}</td>
                      <td>{item.wbs_code || 'None'}</td>
                      <td style={{ fontWeight: 650 }}>{item.available_qty}</td>
                      <td style={{ fontWeight: 550, color: 'var(--success)' }}>
                        ${item.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

export default ReportsModule;
