import React, { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, AlertCircle, ShoppingBag, Eye, FileText, CheckCircle, PenTool, Eraser, X } from 'lucide-react';
import { Stock, Plant, StorageLocation, Project, Department, CostCenter } from '../types';
import SearchableSelect from './SearchableSelect';
import ModuleDataTools from './ModuleDataTools';

interface MaterialMasterProps {
  apiBase: string;
  token: string;
  plants: Plant[];
  storageLocations: StorageLocation[];
  projects: Project[];
  departments: Department[];
  userRole?: string | null;
}

const MaterialMaster: React.FC<MaterialMasterProps> = ({
  apiBase,
  token,
  plants,
  storageLocations,
  projects,
  departments,
  userRole
}) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedLoc, setSelectedLoc] = useState('');
  const [selectedWbs, setSelectedWbs] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Transaction History Modal states
  const [showTxModal, setShowTxModal] = useState(false);
  const [selectedMatCode, setSelectedMatCode] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // 2. Direct Issuance Modal states
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  // Form states for Direct Issuance
  const [requestedQty, setRequestedQty] = useState(0);
  const [requestedBy, setRequestedBy] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedProj, setSelectedProj] = useState('');
  const [issueAccountType, setIssueAccountType] = useState<'project' | 'cost_center'>('project');
  const [selectedCostCenter, setSelectedCostCenter] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Flatbed Truck');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [driverIqama, setDriverIqama] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [issueLoading, setIssueLoading] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  // Signature drawing canvas states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Fetch transaction history
  const fetchTransactions = async (matCode: string) => {
    setTxLoading(true);
    try {
      const res = await fetch(`${apiBase}/materials/${encodeURIComponent(matCode)}/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch transactions.');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleSelectMaterial = (matCode: string) => {
    setSelectedMatCode(matCode);
    setTransactions([]);
    setShowTxModal(true);
    fetchTransactions(matCode);
  };

  // Direct issue execution
  const handleDirectIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;

    if (requestedQty <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }

    if (requestedQty > selectedStock.available_qty) {
      alert(`Insufficient stock. Available is only ${selectedStock.available_qty}.`);
      return;
    }

    // Check canvas signature
    let signatureBase64 = '';
    const canvas = canvasRef.current;
    if (canvas) {
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      if (canvas.toDataURL() !== blank.toDataURL()) {
        signatureBase64 = canvas.toDataURL();
      }
    }

    if (!requestedBy) {
      alert("Requestor Name is required.");
      return;
    }

    if (issueAccountType === 'project' && !selectedProj) {
      alert("Project selection is required for project-based issuance.");
      return;
    }

    if (issueAccountType === 'cost_center' && !selectedCostCenter) {
      alert("Cost center selection is required for cost center-based issuance.");
      return;
    }

    if (!vehicleNumber || !driverName || !driverMobile || !driverIqama || !transportCompany || !receiverName || !receiverMobile) {
      alert("All transport, driver details, and receiver information are required.");
      return;
    }

    setIssueLoading(true);
    try {
      const res = await fetch(`${apiBase}/mrf/direct-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          material_code: selectedStock.material_code,
          plant_code: selectedStock.plant_code,
          storage_location_code: selectedStock.storage_location_code,
          wbs_code: selectedStock.wbs_code || null,
          quantity: parseFloat(requestedQty.toString()),
          requested_by_name: requestedBy,
          department_id: selectedDept ? parseInt(selectedDept) : null,
          project_code: issueAccountType === 'project' ? selectedProj : null,
          issue_account_type: issueAccountType,
          cost_center_code: issueAccountType === 'cost_center' ? selectedCostCenter : null,
          purpose: purpose || null,
          vehicle_number: vehicleNumber,
          vehicle_type: vehicleType,
          driver_name: driverName,
          driver_mobile: driverMobile,
          driver_iqama: driverIqama,
          transport_company: transportCompany,
          receiver_name: receiverName,
          receiver_mobile: receiverMobile,
          delivery_location: deliveryLocation || null,
          remarks: remarks || null,
          signature: signatureBase64 || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit direct issuance.');
      }

      alert("Material issued directly successfully!");
      setShowIssueModal(false);
      // Reset form
      setRequestedQty(0);
      setRequestedBy('');
      setSelectedDept('');
      setSelectedProj('');
      setSelectedCostCenter('');
      setIssueAccountType('project');
      setPurpose('');
      setVehicleNumber('');
      setDriverName('');
      setDriverMobile('');
      setDriverIqama('');
      setTransportCompany('');
      setReceiverName('');
      setReceiverMobile('');
      setDeliveryLocation('');
      setRemarks('');
      // Refresh list
      fetchStock();
    } catch (err: any) {
      alert(err.message || 'Error occurred during direct issuance.');
    } finally {
      setIssueLoading(false);
    }
  };

  // Canvas drawing handlers
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

  useEffect(() => {
    if (showIssueModal) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
          }
        }
      }, 100);
    }
  }, [showIssueModal]);

  useEffect(() => {
    fetch(`${apiBase}/company/cost-centers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setCostCenters(data))
      .catch(err => console.error(err));
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    try {
      let url = `${apiBase}/materials/stock/search`;
      if (searchTerm) {
        url += `?search_term=${encodeURIComponent(searchTerm)}`;
      }
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch stocks.');
      
      const data = await res.json();
      
      // Filter clientside for precise plant/loc matches if selected
      let filtered = data;
      if (selectedPlant) {
        filtered = filtered.filter((s: Stock) => s.plant_code === selectedPlant);
      }
      if (selectedLoc) {
        filtered = filtered.filter((s: Stock) => s.storage_location_code === selectedLoc);
      }
      if (selectedWbs) {
        filtered = filtered.filter((s: Stock) => s.wbs_code && s.wbs_code.toLowerCase().includes(selectedWbs.toLowerCase()));
      }
      
      setStocks(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [searchTerm, selectedPlant, selectedLoc, selectedWbs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey="stock" onComplete={fetchStock} userRole={userRole} />
      </div>
      {/* Search and Filters panel */}
      <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="input-field"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search material code, description, plant..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        {/* Plant filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Plant:</span>
          <SearchableSelect
            options={[
              { value: '', label: 'All Plants', description: 'Show stock for all plants' },
              ...plants.map(p => ({ value: p.code, label: p.code, description: p.name }))
            ]}
            value={selectedPlant}
            onChange={val => { setSelectedPlant(val); setSelectedLoc(''); }}
            placeholder="Search Plant..."
          />
        </div>

        {/* Location filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Storage Loc:</span>
          <SearchableSelect
            options={[
              { value: '', label: 'All Locations', description: 'Show stock for all locations' },
              ...storageLocations
                .filter(loc => !selectedPlant || loc.plant_code === selectedPlant)
                .map(loc => ({ value: loc.code, label: loc.code, description: loc.name }))
            ]}
            value={selectedLoc}
            onChange={setSelectedLoc}
            placeholder="Search Loc..."
          />
        </div>

        {/* WBS filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>WBS:</span>
          <input
            type="text"
            className="input-field"
            style={{ padding: '0.5rem 0.8rem', width: '120px' }}
            placeholder="WBS Element"
            value={selectedWbs}
            onChange={e => setSelectedWbs(e.target.value)}
          />
        </div>
      </div>

      {/* Stock ledger list */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 650 }}>Stock Ledger Balance</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Found {stocks.length} records
          </span>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Description</th>
                <th>UOM</th>
                <th>Plant</th>
                <th>Loc</th>
                <th>WBS Element</th>
                <th>Available Qty</th>
                <th>Blocked Qty</th>
                <th>Quality Insp.</th>
                <th>In Transit</th>
                <th>Value</th>
                <th>Last Synced</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Syncing Ledger balance records...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No matching stock items found. Try uploading a new MB52 report.
                  </td>
                </tr>
              ) : (
                stocks.map(stock => (
                  <tr key={stock.id}>
                    <td style={{ fontWeight: 600 }}>
                      <button
                        onClick={() => handleSelectMaterial(stock.material_code)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          textAlign: 'left'
                        }}
                        title="Click to view previous transactions"
                      >
                        {stock.material_code}
                      </button>
                    </td>
                    <td>{stock.description}</td>
                    <td><span className="badge badge-info">{stock.uom || 'EA'}</span></td>
                    <td>{stock.plant_code}</td>
                    <td>{stock.storage_location_code}</td>
                    <td>{stock.wbs_code || <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>}</td>
                    <td style={{ fontWeight: 650, color: stock.available_qty > 0 ? 'inherit' : 'var(--text-muted)' }}>
                      {stock.available_qty}
                    </td>
                    <td style={{ color: stock.blocked_qty > 0 ? 'var(--danger)' : 'inherit' }}>
                      {stock.blocked_qty}
                    </td>
                    <td style={{ color: stock.quality_inspection_qty > 0 ? 'var(--warning)' : 'inherit' }}>
                      {stock.quality_inspection_qty}
                    </td>
                    <td style={{ color: stock.transit_qty > 0 ? 'var(--info)' : 'inherit' }}>
                      {stock.transit_qty}
                    </td>
                    <td style={{ fontWeight: 550 }}>
                      ${stock.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(stock.updated_at).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedStock(stock);
                          setRequestedQty(0);
                          setShowIssueModal(true);
                        }}
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          whiteSpace: 'nowrap'
                        }}
                        disabled={stock.available_qty <= 0}
                      >
                        <ShoppingBag size={12} />
                        Direct Issue
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: TRANSACTION HISTORY POPUP */}
      {showTxModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div className="glass" style={{
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <button
              onClick={() => setShowTxModal(false)}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
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

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} style={{ color: 'var(--primary)' }} />
              Transaction History Ledger: {selectedMatCode}
            </h3>

            <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '1rem' }} className="table-container">
              <table className="custom-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Reference #</th>
                    <th>Impact Qty</th>
                    <th>Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Fetching transactional ledger logs...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No transaction movements recorded for this material code yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={`badge ${
                            tx.type === 'Receiving' ? 'badge-success' :
                            tx.type === 'Transfer' ? 'badge-info' :
                            tx.type === 'Issuance' ? 'badge-warning' : 'badge-danger'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td>{tx.date}</td>
                        <td style={{ fontWeight: 600 }}>{tx.reference}</td>
                        <td style={{
                          fontWeight: 700,
                          color: tx.quantity < 0 ? 'var(--danger)' : tx.quantity > 0 ? 'var(--success)' : 'inherit'
                        }}>
                          {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity === 0 ? '0' : tx.quantity}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{tx.details}</td>
                        <td>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            backgroundColor: tx.status === 'Issued' || tx.status === 'Received' || tx.status === 'Transferred' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                            color: tx.status === 'Issued' || tx.status === 'Received' || tx.status === 'Transferred' ? 'var(--success)' : 'inherit'
                          }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowTxModal(false)}>
                Close Ledger View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DIRECT MATERIAL ISSUANCE FORM */}
      {showIssueModal && selectedStock && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <form onSubmit={handleDirectIssueSubmit} className="glass" style={{
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              onClick={() => setShowIssueModal(false)}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
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

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={20} style={{ color: 'var(--primary)' }} />
              Direct Material Issuance Request
            </h3>

            <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Material information block */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Material Code</span>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedStock.material_code}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Description</span>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{selectedStock.description}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Source Location</span>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>Plant {selectedStock.plant_code} / Loc {selectedStock.storage_location_code}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Stock</span>
                  <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>{selectedStock.available_qty} {selectedStock.uom || 'PCS'}</p>
                </div>
              </div>

              {/* Form inputs section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantity to Issue (Max: {selectedStock.available_qty})</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    max={selectedStock.available_qty}
                    step="any"
                    className="input-field"
                    value={requestedQty || ''}
                    onChange={e => setRequestedQty(parseFloat(e.target.value) || 0)}
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Requestor Name (Full Name)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={requestedBy}
                    onChange={e => setRequestedBy(e.target.value)}
                    placeholder="Name of person receiving stock"
                  />
                </div>

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
                      onChange={e => setSelectedProj(e.target.value)}
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      required
                      className="input-field"
                      value={selectedCostCenter}
                      onChange={e => setSelectedCostCenter(e.target.value)}
                    >
                      <option value="">Select Cost Center</option>
                      {costCenters.map(cc => (
                        <option key={cc.code} value={cc.code}>{cc.code} - {cc.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    required
                    className="input-field"
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Logistics & Dispatch fields (REQUIRED) */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 650, color: 'var(--primary)', marginBottom: '0.75rem' }}>
                  Required Dispatch & Transportation Logistics
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle Plate Number</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      placeholder="e.g. B-X-9884"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <input
                      type="text"
                      className="input-field"
                      value={vehicleType}
                      onChange={e => setVehicleType(e.target.value)}
                      placeholder="e.g. Flatbed Truck"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Driver Full Name</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="Driver's legal name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Driver Mobile</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={driverMobile}
                      onChange={e => setDriverMobile(e.target.value)}
                      placeholder="+966551234567"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Driver Iqama / ID Number</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={driverIqama}
                      onChange={e => setDriverIqama(e.target.value)}
                      placeholder="10-digit National ID"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Transport Company Name</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={transportCompany}
                      onChange={e => setTransportCompany(e.target.value)}
                      placeholder="e.g. Al-Majd Transport"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Receiver POC Name</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={receiverName}
                      onChange={e => setReceiverName(e.target.value)}
                      placeholder="Receiver contact person"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Receiver POC Mobile</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={receiverMobile}
                      onChange={e => setReceiverMobile(e.target.value)}
                      placeholder="Receiver mobile number"
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Delivery Location</label>
                    <input
                      type="text"
                      className="input-field"
                      value={deliveryLocation}
                      onChange={e => setDeliveryLocation(e.target.value)}
                      placeholder="Specify building, yard, or project sector address"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks and hand signature */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Purpose / Remarks</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '110px', resize: 'vertical' }}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Describe purpose of direct issue..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Draw Recipient Hand Signature (Required)</span>
                    <button type="button" onClick={clearCanvas} style={{ border: 'none', background: 'none', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Eraser size={12} />
                      Clear
                    </button>
                  </label>
                  
                  <div className="signature-canvas-container" style={{ height: '110px' }}>
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={110}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                  </div>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowIssueModal(false)} disabled={issueLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={issueLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={16} />
                {issueLoading ? 'Processing Issuance...' : 'Confirm Direct Issuance'}
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
};

export default MaterialMaster;
