import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MB52Upload from './components/MB52Upload';
import MaterialMaster from './components/MaterialMaster';
import MaterialCatalog from './components/MaterialCatalog';
import MRFForm from './components/MRFForm';
import MRFList from './components/MRFList';
import ReceivingModule from './components/ReceivingModule';
import TransferModule from './components/TransferModule';
import ReportsModule from './components/ReportsModule';
import SettingsModule from './components/SettingsModule';
import CompanySetup from './components/CompanySetup';
import ModuleDataTools from './components/ModuleDataTools';
import { User, Plant, StorageLocation, Warehouse, Project, WbsElement, Department, CostCenter, MRF, MaterialReceiving, MaterialTransfer, Discrepancy, MB52UploadHistory, Cancellation, AuditTrail, CompanySetting } from './types';

const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000/api/v1`
  : '/api/v1';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'dark');
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isCreatingMRF, setIsCreatingMRF] = useState<boolean>(false);

  // Loaded database entities
  const [plants, setPlants] = useState<Plant[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [wbsElements, setWbsElements] = useState<WbsElement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [mrfs, setMrfs] = useState<MRF[]>([]);
  const [receivings, setReceivings] = useState<MaterialReceiving[]>([]);
  const [transfers, setTransfers] = useState<MaterialTransfer[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [uploadHistory, setUploadHistory] = useState<MB52UploadHistory[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditTrail[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [companySetting, setCompanySetting] = useState<CompanySetting | null>(null);

  // Sync / Fetch functions
  const syncData = async (accessToken: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      // 1. Current user details
      const userRes = await fetch(`${API_BASE}/auth/me`, { headers });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      } else {
        handleLogout();
        return;
      }

      // 2. Dashboard KPIs
      const dbRes = await fetch(`${API_BASE}/reports/dashboard`, { headers });
      if (dbRes.ok) setDashboardMetrics(await dbRes.ok ? await dbRes.json() : null);

      // 3. Organization Setup
      const plantsRes = await fetch(`${API_BASE}/company/plants`, { headers });
      if (plantsRes.ok) setPlants(await plantsRes.json());

      const locRes = await fetch(`${API_BASE}/company/storage-locations`, { headers });
      if (locRes.ok) setStorageLocations(await locRes.json());

      const whRes = await fetch(`${API_BASE}/company/warehouses`, { headers });
      if (whRes.ok) setWarehouses(await whRes.json());

      const projRes = await fetch(`${API_BASE}/company/projects`, { headers });
      if (projRes.ok) setProjects(await projRes.json());

      const wbsRes = await fetch(`${API_BASE}/company/wbs-elements`, { headers });
      if (wbsRes.ok) setWbsElements(await wbsRes.json());

      const deptRes = await fetch(`${API_BASE}/company/departments`, { headers });
      if (deptRes.ok) setDepartments(await deptRes.json());

      const costCenterRes = await fetch(`${API_BASE}/company/cost-centers`, { headers });
      if (costCenterRes.ok) setCostCenters(await costCenterRes.json());

      // 4. Users list for company setup (Managers see this)
      const usersRes = await fetch(`${API_BASE}/auth/users`, { headers });
      if (usersRes.ok) setUsers(await usersRes.json());

      // 5. Transactions
      const mrfRes = await fetch(`${API_BASE}/mrf/`, { headers });
      if (mrfRes.ok) setMrfs(await mrfRes.json());

      const recRes = await fetch(`${API_BASE}/receiving/`, { headers });
      if (recRes.ok) setReceivings(await recRes.json());

      const transRes = await fetch(`${API_BASE}/transfer/`, { headers });
      if (transRes.ok) setTransfers(await transRes.json());

      // 6. MB52 status logs & discrepancies
      const discRes = await fetch(`${API_BASE}/mb52/discrepancies`, { headers });
      if (discRes.ok) setDiscrepancies(await discRes.json());

      const histRes = await fetch(`${API_BASE}/mb52/history`, { headers });
      if (histRes.ok) setUploadHistory(await histRes.json());

      // 7. Audits & Rollbacks
      const cancelRes = await fetch(`${API_BASE}/reports/cancellations`, { headers });
      if (cancelRes.ok) setCancellations(await cancelRes.json());

      const auditRes = await fetch(`${API_BASE}/settings/audit`, { headers });
      if (auditRes.ok) setAuditLogs(await auditRes.json());

      // 8. Company settings (Branding)
      const companyRes = await fetch(`${API_BASE}/settings/company`, { headers });
      if (companyRes.ok) setCompanySetting(await companyRes.json());

    } catch (err) {
      console.error("Sync error: ", err);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE}/settings/company/public`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setCompanySetting(data);
      })
      .catch(err => console.error("Public company settings load failed:", err));
  }, []);

  useEffect(() => {
    if (token) {
      syncData(token);
    } else {
      setUser(null);
    }
  }, [token]);

  // Apply theme class
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogin = (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const forceSync = () => {
    if (token) syncData(token);
  };

  if (!token) {
    return <Login onLogin={handleLogin} apiBase={API_BASE} companySetting={companySetting} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentView={isCreatingMRF ? 'mrf' : currentView} 
        setCurrentView={(view) => {
          setCurrentView(view);
          setIsCreatingMRF(false);
        }} 
        user={user} 
        onLogout={handleLogout} 
        theme={theme}
        toggleTheme={toggleTheme}
        companySetting={companySetting}
      />

      {/* Main content pane */}
      <main className="main-content">
        <Header 
          currentView={currentView} 
          user={user} 
          discrepancies={discrepancies} 
          onAlertClick={() => {
            setCurrentView('mb52');
            setIsCreatingMRF(false);
          }} 
        />

        {/* View Switch Routing */}
        {isCreatingMRF ? (
          <MRFForm
            apiBase={API_BASE}
            token={token}
            departments={departments}
            projects={projects}
            warehouses={warehouses}
            wbsElements={wbsElements}
            plants={plants}
            storageLocations={storageLocations}
            onSuccess={() => {
              setIsCreatingMRF(false);
              forceSync();
            }}
            onCancel={() => setIsCreatingMRF(false)}
          />
        ) : (
          <>
            {currentView === 'dashboard' && (
              <Dashboard 
                metrics={dashboardMetrics} 
                onRefresh={forceSync} 
                setCurrentView={(view) => {
                  setCurrentView(view);
                  setIsCreatingMRF(false);
                }} 
              />
            )}

            {currentView === 'mb52' && (
              <MB52Upload 
                uploadHistory={uploadHistory} 
                discrepancies={discrepancies} 
                apiBase={API_BASE} 
                token={token} 
                onRefresh={forceSync}
                user={user}
              />
            )}

            {currentView === 'catalog' && (
              <MaterialCatalog
                apiBase={API_BASE}
                token={token}
                onRefresh={forceSync}
                userRole={user?.role}
              />
            )}

            {currentView === 'materials' && (
              <MaterialMaster 
                apiBase={API_BASE} 
                token={token} 
                plants={plants} 
                storageLocations={storageLocations} 
                projects={projects}
                departments={departments}
                userRole={user?.role}
              />
            )}

            {currentView === 'mrf' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <ModuleDataTools apiBase={API_BASE} token={token} moduleKey="mrf" onComplete={forceSync} userRole={user?.role} />
                  <button className="btn btn-primary" onClick={() => setIsCreatingMRF(true)}>
                    Create New Request Form
                  </button>
                </div>
                <MRFList 
                  mrfs={mrfs} 
                  user={user} 
                  departments={departments} 
                  warehouses={warehouses} 
                  apiBase={API_BASE} 
                  token={token} 
                  onRefresh={forceSync} 
                />
              </div>
            )}

            {currentView === 'receiving' && (
              <ReceivingModule 
                apiBase={API_BASE} 
                token={token} 
                plants={plants} 
                storageLocations={storageLocations} 
                wbsElements={wbsElements} 
                receivings={receivings} 
                onRefresh={forceSync}
                user={user}
              />
            )}

            {currentView === 'transfer' && (
              <TransferModule 
                apiBase={API_BASE} 
                token={token} 
                plants={plants} 
                storageLocations={storageLocations} 
                wbsElements={wbsElements} 
                transfers={transfers} 
                user={user} 
                onRefresh={forceSync} 
              />
            )}

            {currentView === 'reports' && (
              <ReportsModule 
                apiBase={API_BASE} 
                token={token} 
                auditLogs={auditLogs} 
                cancellations={cancellations} 
                onRefresh={forceSync}
                user={user}
              />
            )}

            {currentView === 'company' && (
              <CompanySetup 
                apiBase={API_BASE} 
                token={token} 
                plants={plants} 
                storageLocations={storageLocations} 
                warehouses={warehouses} 
                projects={projects} 
                wbsElements={wbsElements} 
                departments={departments} 
                costCenters={costCenters}
                users={users} 
                currentUser={user}
                onRefresh={forceSync} 
              />
            )}

            {currentView === 'settings' && (
              <SettingsModule 
                apiBase={API_BASE} 
                token={token} 
                onRefresh={forceSync} 
                companySetting={companySetting}
                user={user}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
