import React, { useState } from 'react';
import { Building2, Plus, Users, Landmark, Tag, Edit2, Trash2, X, Package } from 'lucide-react';
import { Plant, StorageLocation, Warehouse, Project, WbsElement, Department, CostCenter, User } from '../types';
import ModuleDataTools from './ModuleDataTools';

interface CompanySetupProps {
  apiBase: string;
  token: string;
  plants: Plant[];
  storageLocations: StorageLocation[];
  warehouses: Warehouse[];
  projects: Project[];
  wbsElements: WbsElement[];
  departments: Department[];
  costCenters: CostCenter[];
  users: User[];
  currentUser: User | null;
  onRefresh: () => void;
}

const CompanySetup: React.FC<CompanySetupProps> = ({
  apiBase,
  token,
  plants,
  storageLocations,
  warehouses,
  projects,
  wbsElements,
  departments,
  costCenters,
  users,
  currentUser,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'plants' | 'locations' | 'warehouses' | 'projects' | 'wbs' | 'departments' | 'costCenters' | 'users'>('plants');
  const [loading, setLoading] = useState(false);

  // Field states for additions
  const [plantCode, setPlantCode] = useState('');
  const [plantName, setPlantName] = useState('');
  const [plantLoc, setPlantLoc] = useState('');

  const [locCode, setLocCode] = useState('');
  const [locPlant, setLocPlant] = useState('');
  const [locName, setLocName] = useState('');

  const [whName, setWhName] = useState('');
  const [whLoc, setWhLoc] = useState('');
  const [whDesc, setWhDesc] = useState('');

  const [projCode, setProjCode] = useState('');
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const [wbsCode, setWbsCode] = useState('');
  const [wbsProj, setWbsProj] = useState('');
  const [wbsDesc, setWbsDesc] = useState('');

  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [costCenterCode, setCostCenterCode] = useState('');
  const [costCenterName, setCostCenterName] = useState('');
  const [costCenterDesc, setCostCenterDesc] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [newUserRole, setNewUserRole] = useState('Warehouse Worker');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Edit state variables
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [editPlantName, setEditPlantName] = useState('');
  const [editPlantLoc, setEditPlantLoc] = useState('');

  const [editingLoc, setEditingLoc] = useState<StorageLocation | null>(null);
  const [editLocName, setEditLocName] = useState('');

  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editWhName, setEditWhName] = useState('');
  const [editWhLoc, setEditWhLoc] = useState('');
  const [editWhDesc, setEditWhDesc] = useState('');

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjName, setEditProjName] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');

  const [editingWbs, setEditingWbs] = useState<WbsElement | null>(null);
  const [editWbsProj, setEditWbsProj] = useState('');
  const [editWbsDesc, setEditWbsDesc] = useState('');

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptDesc, setEditDeptDesc] = useState('');
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [editCostCenterName, setEditCostCenterName] = useState('');
  const [editCostCenterDesc, setEditCostCenterDesc] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserMobile, setEditUserMobile] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserActive, setEditUserActive] = useState(true);
  const [editUserPassword, setEditUserPassword] = useState('');

  // Stock inspection states
  const [inspectingStockType, setInspectingStockType] = useState<'plant' | 'location' | 'project' | 'wbs' | null>(null);
  const [inspectingStockId, setInspectingStockId] = useState<string | null>(null);
  const [inspectingStockTitle, setInspectingStockTitle] = useState('');
  const [inspectingStockData, setInspectingStockData] = useState<any[]>([]);
  const [inspectingStockLoading, setInspectingStockLoading] = useState(false);

  const startInspectStock = async (type: 'plant' | 'location' | 'project' | 'wbs', id: string, title: string) => {
    setInspectingStockType(type);
    setInspectingStockId(id);
    setInspectingStockTitle(title);
    setInspectingStockLoading(true);
    setInspectingStockData([]);
    
    try {
      let queryParam = '';
      if (type === 'plant') queryParam = `plant_code=${id}`;
      else if (type === 'location') queryParam = `storage_location_code=${id}`;
      else if (type === 'project') queryParam = `project_code=${id}`;
      else if (type === 'wbs') queryParam = `wbs_code=${id}`;
      
      const res = await fetch(`${apiBase}/materials/stock/search?${queryParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stock details');
      const data = await res.json();
      setInspectingStockData(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInspectingStockLoading(false);
    }
  };

  // Edit populators
  const startEditPlant = (plant: Plant) => {
    setEditingPlant(plant);
    setEditPlantName(plant.name);
    setEditPlantLoc(plant.location || '');
  };

  const startEditLoc = (loc: StorageLocation) => {
    setEditingLoc(loc);
    setEditLocName(loc.name);
  };

  const startEditWarehouse = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setEditWhName(wh.name);
    setEditWhLoc(wh.location || '');
    setEditWhDesc(wh.description || '');
  };

  const startEditProject = (proj: Project) => {
    setEditingProject(proj);
    setEditProjName(proj.name);
    setEditProjDesc(proj.description || '');
  };

  const startEditWbs = (wbs: WbsElement) => {
    setEditingWbs(wbs);
    setEditWbsProj(wbs.project_code);
    setEditWbsDesc(wbs.description || '');
  };

  const startEditDept = (dept: Department) => {
    setEditingDept(dept);
    setEditDeptName(dept.name);
    setEditDeptDesc(dept.description || '');
  };

  const startEditCostCenter = (cc: CostCenter) => {
    setEditingCostCenter(cc);
    setEditCostCenterName(cc.name);
    setEditCostCenterDesc(cc.description || '');
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserMobile(user.mobile || '');
    setEditUserRole(user.role);
    setEditUserActive(user.is_active);
    setEditUserPassword('');
  };

  // Submit handlers
  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/plants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: plantCode, name: plantName, location: plantLoc })
      });
      if (!res.ok) throw new Error('Failed to create plant');
      setPlantCode(''); setPlantName(''); setPlantLoc('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlant) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/plants/${editingPlant.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: editingPlant.code, name: editPlantName, location: editPlantLoc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update plant');
      }
      setEditingPlant(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeletePlant = async (code: string) => {
    if (!window.confirm(`Are you sure you want to delete plant ${code}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/plants/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete plant');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/storage-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: locCode, plant_code: locPlant, name: locName })
      });
      if (!res.ok) throw new Error('Failed to create location');
      setLocCode(''); setLocName('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoc) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/storage-locations/${editingLoc.plant_code}/${editingLoc.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: editingLoc.code, plant_code: editingLoc.plant_code, name: editLocName })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update storage location');
      }
      setEditingLoc(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteLoc = async (plantCode: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete storage location ${code} from plant ${plantCode}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/storage-locations/${plantCode}/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete storage location');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: whName, location: whLoc, description: whDesc })
      });
      if (!res.ok) throw new Error('Failed to create warehouse');
      setWhName(''); setWhLoc(''); setWhDesc('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/warehouses/${editingWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editWhName, location: editWhLoc, description: editWhDesc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update warehouse');
      }
      setEditingWarehouse(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteWarehouse = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete warehouse "${name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/warehouses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete warehouse');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: projCode, name: projName, description: projDesc })
      });
      if (!res.ok) throw new Error('Failed to create project');
      setProjCode(''); setProjName(''); setProjDesc('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/projects/${editingProject.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: editingProject.code, name: editProjName, description: editProjDesc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update project');
      }
      setEditingProject(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteProject = async (code: string) => {
    if (!window.confirm(`Are you sure you want to delete project ${code}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/projects/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete project');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddWbs = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/wbs-elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: wbsCode, project_code: wbsProj, description: wbsDesc })
      });
      if (!res.ok) throw new Error('Failed to create WBS element');
      setWbsCode(''); setWbsDesc('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditWbs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWbs) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/wbs-elements/${editingWbs.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: editingWbs.code, project_code: editWbsProj, description: editWbsDesc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update WBS element');
      }
      setEditingWbs(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteWbs = async (code: string) => {
    if (!window.confirm(`Are you sure you want to delete WBS element ${code}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/wbs-elements/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete WBS element');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: deptName, description: deptDesc })
      });
      if (!res.ok) throw new Error('Failed to create department');
      setDeptName(''); setDeptDesc('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/departments/${editingDept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editDeptName, description: editDeptDesc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update department');
      }
      setEditingDept(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteDept = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete department "${name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete department');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/cost-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: costCenterCode, name: costCenterName, description: costCenterDesc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create cost center');
      }
      setCostCenterCode(''); setCostCenterName(''); setCostCenterDesc('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCostCenter) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/cost-centers/${editingCostCenter.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: editingCostCenter.code, name: editCostCenterName, description: editCostCenterDesc })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update cost center');
      }
      setEditingCostCenter(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteCostCenter = async (code: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete cost center "${code} - ${name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/company/cost-centers/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete cost center');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          username: newUsername,
          password: newUserPassword,
          name: newUserName,
          email: newUserEmail,
          mobile: newUserMobile || null,
          role: newUserRole
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create user');
      }
      setNewUserName('');
      setNewUsername('');
      setNewUserEmail('');
      setNewUserMobile('');
      setNewUserRole('Warehouse Worker');
      setNewUserPassword('');
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const body: any = {
        name: editUserName,
        email: editUserEmail,
        mobile: editUserMobile || null,
        role: editUserRole,
        is_active: editUserActive
      };
      if (editUserPassword) {
        body.password = editUserPassword;
      }
      const res = await fetch(`${apiBase}/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update user');
      }
      setEditingUser(null);
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete user');
      }
      onRefresh();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const getTabModuleInfo = () => {
    switch (activeTab) {
      case 'plants': return { key: 'plants', title: 'Plants' };
      case 'locations': return { key: 'storage_locations', title: 'Storage Locs' };
      case 'warehouses': return { key: 'warehouses', title: 'Warehouses' };
      case 'projects': return { key: 'projects', title: 'Projects' };
      case 'wbs': return { key: 'wbs_elements', title: 'WBS Elements' };
      case 'departments': return { key: 'departments', title: 'Departments' };
      case 'costCenters': return { key: 'cost_centers', title: 'Cost Centers' };
      case 'users': return { key: 'users', title: 'Users' };
      default: return { key: 'company', title: 'Company' };
    }
  };
  const tabModule = getTabModuleInfo();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ModuleDataTools apiBase={apiBase} token={token} moduleKey={tabModule.key} title={tabModule.title} onComplete={onRefresh} userRole={currentUser?.role} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* Navigation Submenu */}
      <div className="glass" style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.2rem' }}>
        {[
          { id: 'plants', label: 'Plants' },
          { id: 'locations', label: 'Storage Locs' },
          { id: 'warehouses', label: 'Warehouses' },
          { id: 'projects', label: 'Projects' },
          { id: 'wbs', label: 'WBS Elements' },
          { id: 'departments', label: 'Departments' },
          { id: 'costCenters', label: 'Cost Centers' },
          { id: 'users', label: 'User Directory' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.6rem 0.9rem',
              background: activeTab === tab.id ? 'var(--primary-glow)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 600 : 500
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dynamic Form and Lists Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Tab 1: Plants */}
        {activeTab === 'plants' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Create New Plant</h4>
              <form onSubmit={handleAddPlant} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Plant Code</label>
                  <input type="text" required className="input-field" value={plantCode} onChange={e=>setPlantCode(e.target.value)} placeholder="e.g. PL01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Plant Name</label>
                  <input type="text" required className="input-field" value={plantName} onChange={e=>setPlantName(e.target.value)} placeholder="e.g. Riyadh Central Plant" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location / Address</label>
                  <input type="text" className="input-field" value={plantLoc} onChange={e=>setPlantLoc(e.target.value)} placeholder="Riyadh, Saudi Arabia" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add Plant
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Configured Plants</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Plant Code</th>
                      <th>Plant Name</th>
                      <th>Location</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plants.map(p => (
                      <tr key={p.code}>
                        <td style={{ fontWeight: 600 }}>
                          <span
                            onClick={() => startInspectStock('plant', p.code, `Stock for Plant: ${p.code} - ${p.name}`)}
                            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                          >
                            {p.code}
                          </span>
                        </td>
                        <td>{p.name}</td>
                        <td>{p.location || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => startInspectStock('plant', p.code, `Stock for Plant: ${p.code} - ${p.name}`)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--primary)' }}
                              title="View Stock"
                            >
                              <Package size={12} />
                            </button>
                            <button onClick={() => startEditPlant(p)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeletePlant(p.code)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Locations */}
        {activeTab === 'locations' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Create Storage Location</h4>
              <form onSubmit={handleAddLoc} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Plant Assignment</label>
                  <select required className="input-field" value={locPlant} onChange={e=>setLocPlant(e.target.value)}>
                    <option value="">Select Plant</option>
                    {plants.map(p => (
                      <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location Code</label>
                  <input type="text" required className="input-field" value={locCode} onChange={e=>setLocCode(e.target.value)} placeholder="e.g. SL01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location Name</label>
                  <input type="text" required className="input-field" value={locName} onChange={e=>setLocName(e.target.value)} placeholder="e.g. Bulk Materials Bin" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add Location
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Storage Locations Registry</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Plant Code</th>
                      <th>Location Code</th>
                      <th>Description Name</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageLocations.map((loc, idx) => (
                      <tr key={idx}>
                        <td>{loc.plant_code}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span
                            onClick={() => startInspectStock('location', loc.code, `Stock for Storage Location: ${loc.code} - ${loc.name}`)}
                            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                          >
                            {loc.code}
                          </span>
                        </td>
                        <td>{loc.name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => startInspectStock('location', loc.code, `Stock for Storage Loc: ${loc.code} - ${loc.name}`)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--primary)' }}
                              title="View Stock"
                            >
                              <Package size={12} />
                            </button>
                            <button onClick={() => startEditLoc(loc)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteLoc(loc.plant_code, loc.code)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Warehouses */}
        {activeTab === 'warehouses' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Create Warehouse Profile</h4>
              <form onSubmit={handleAddWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Warehouse Name</label>
                  <input type="text" required className="input-field" value={whName} onChange={e=>setWhName(e.target.value)} placeholder="e.g. WH-1 Riyadh" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input type="text" className="input-field" value={whLoc} onChange={e=>setWhLoc(e.target.value)} placeholder="Sector 4, Riyadh" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Remarks</label>
                  <input type="text" className="input-field" value={whDesc} onChange={e=>setWhDesc(e.target.value)} placeholder="Main spare parts hub" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Create Warehouse
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Active Warehouses</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>WH ID</th>
                      <th>Warehouse Name</th>
                      <th>Location</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map(w => (
                      <tr key={w.id}>
                        <td>#{w.id}</td>
                        <td style={{ fontWeight: 600 }}>{w.name}</td>
                        <td>{w.location || 'N/A'}</td>
                        <td>{w.description || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEditWarehouse(w)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteWarehouse(w.id, w.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Projects */}
        {activeTab === 'projects' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Add Project</h4>
              <form onSubmit={handleAddProject} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Project Code</label>
                  <input type="text" required className="input-field" value={projCode} onChange={e=>setProjCode(e.target.value)} placeholder="e.g. PRJ-METRO" />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input type="text" required className="input-field" value={projName} onChange={e=>setProjName(e.target.value)} placeholder="e.g. Riyadh Metro Extension" />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Description</label>
                  <input type="text" className="input-field" value={projDesc} onChange={e=>setProjDesc(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add Project
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Registered Projects</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Project Code</th>
                      <th>Project Name</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr key={p.code}>
                        <td style={{ fontWeight: 600 }}>
                          <span
                            onClick={() => startInspectStock('project', p.code, `Stock for Project: ${p.code} - ${p.name}`)}
                            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                          >
                            {p.code}
                          </span>
                        </td>
                        <td>{p.name}</td>
                        <td>{p.description || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => startInspectStock('project', p.code, `Stock for Project: ${p.code} - ${p.name}`)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--primary)' }}
                              title="View Stock"
                            >
                              <Package size={12} />
                            </button>
                            <button onClick={() => startEditProject(p)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteProject(p.code)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: WBS Elements */}
        {activeTab === 'wbs' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Add WBS Element</h4>
              <form onSubmit={handleAddWbs} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Project Code</label>
                  <select required className="input-field" value={wbsProj} onChange={e=>setWbsProj(e.target.value)}>
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">WBS Code</label>
                  <input type="text" required className="input-field" value={wbsCode} onChange={e=>setWbsCode(e.target.value)} placeholder="e.g. WBS-METRO-01.03" />
                </div>
                <div className="form-group">
                  <label className="form-label">WBS Description</label>
                  <input type="text" className="input-field" value={wbsDesc} onChange={e=>setWbsDesc(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add WBS Element
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Registered WBS Elements</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Project Code</th>
                      <th>WBS Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wbsElements.map(wbs => (
                      <tr key={wbs.code}>
                        <td>{wbs.project_code}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span
                            onClick={() => startInspectStock('wbs', wbs.code, `Stock for WBS Element: ${wbs.code} - ${wbs.description}`)}
                            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                          >
                            {wbs.code}
                          </span>
                        </td>
                        <td>{wbs.description || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => startInspectStock('wbs', wbs.code, `Stock for WBS Element: ${wbs.code} - ${wbs.description}`)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--primary)' }}
                              title="View Stock"
                            >
                              <Package size={12} />
                            </button>
                            <button onClick={() => startEditWbs(wbs)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteWbs(wbs.code)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Departments */}
        {activeTab === 'departments' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Add Department</h4>
              <form onSubmit={handleAddDept} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Department Name</label>
                  <input type="text" required className="input-field" value={deptName} onChange={e=>setDeptName(e.target.value)} placeholder="e.g. Civil Construction" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input type="text" className="input-field" value={deptDesc} onChange={e=>setDeptDesc(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add Department
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Registered Departments</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Dept ID</th>
                      <th>Department Name</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id}>
                        <td>#{d.id}</td>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td>{d.description || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEditDept(d)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteDept(d.id, d.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'costCenters' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Add Cost Center</h4>
              <form onSubmit={handleAddCostCenter} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Cost Center Code</label>
                  <input type="text" required className="input-field" value={costCenterCode} onChange={e => setCostCenterCode(e.target.value)} placeholder="e.g. CC-OPS-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Center Name</label>
                  <input type="text" required className="input-field" value={costCenterName} onChange={e => setCostCenterName(e.target.value)} placeholder="e.g. Operations Consumables" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input type="text" className="input-field" value={costCenterDesc} onChange={e => setCostCenterDesc(e.target.value)} placeholder="Short description" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add Cost Center
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Registered Cost Centers</h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costCenters.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No cost centers configured yet.
                        </td>
                      </tr>
                    ) : costCenters.map(cc => (
                      <tr key={cc.code}>
                        <td style={{ fontWeight: 600 }}>{cc.code}</td>
                        <td>{cc.name}</td>
                        <td>{cc.description || 'N/A'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEditCostCenter(cc)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteCostCenter(cc.code, cc.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Users Directory */}
        {activeTab === 'users' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Create User</h4>
              <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" required className="input-field" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input type="text" required className="input-field" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" required className="input-field" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input type="text" className="input-field" value={newUserMobile} onChange={e => setNewUserMobile(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="input-field" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                    <option value="Admin">Admin</option>
                    <option value="Warehouse Manager">Warehouse Manager</option>
                    <option value="Warehouse Supervisor">Warehouse Supervisor</option>
                    <option value="Warehouse Worker">Warehouse Worker</option>
                    <option value="Requestor">Requestor</option>
                    <option value="Requestor Manager">Requestor Manager</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Temporary Password</label>
                  <input type="password" required className="input-field" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                  <Plus size={14} /> Add User
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={16} style={{ color: 'var(--primary)' }} />
                User and Role Permissions Directory
              </h4>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Log ID</th>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role / Title</th>
                      <th>Active</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge ${
                            u.role === 'Admin' ? 'badge-danger' :
                            u.role.includes('Manager') ? 'badge-success' : 'badge-info'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {u.is_active ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEditUser(u)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} title="Edit">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteUser(u.id, u.username)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff' }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Edit Plant Modal */}
      {editingPlant && (
        <div className="modal-overlay" onClick={() => setEditingPlant(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit Plant: {editingPlant.code}</h3>
              <button onClick={() => setEditingPlant(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditPlant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Plant Name</label>
                <input type="text" required className="input-field" value={editPlantName} onChange={e=>setEditPlantName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Location / Address</label>
                <input type="text" className="input-field" value={editPlantLoc} onChange={e=>setEditPlantLoc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPlant(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Storage Location Modal */}
      {editingLoc && (
        <div className="modal-overlay" onClick={() => setEditingLoc(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit Storage Loc: {editingLoc.code} ({editingLoc.plant_code})</h3>
              <button onClick={() => setEditingLoc(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditLoc} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Location Name</label>
                <input type="text" required className="input-field" value={editLocName} onChange={e=>setEditLocName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingLoc(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Warehouse Modal */}
      {editingWarehouse && (
        <div className="modal-overlay" onClick={() => setEditingWarehouse(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit Warehouse Profile</h3>
              <button onClick={() => setEditingWarehouse(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Warehouse Name</label>
                <input type="text" required className="input-field" value={editWhName} onChange={e=>setEditWhName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input type="text" className="input-field" value={editWhLoc} onChange={e=>setEditWhLoc(e.target.value)} placeholder="Sector 4, Riyadh" />
              </div>
              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <input type="text" className="input-field" value={editWhDesc} onChange={e=>setEditWhDesc(e.target.value)} placeholder="Main spare parts hub" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingWarehouse(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="modal-overlay" onClick={() => setEditingProject(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit Project: {editingProject.code}</h3>
              <button onClick={() => setEditingProject(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input type="text" required className="input-field" value={editProjName} onChange={e=>setEditProjName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Project Description</label>
                <input type="text" className="input-field" value={editProjDesc} onChange={e=>setEditProjDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProject(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit WBS Element Modal */}
      {editingWbs && (
        <div className="modal-overlay" onClick={() => setEditingWbs(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit WBS Element: {editingWbs.code}</h3>
              <button onClick={() => setEditingWbs(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditWbs} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Project Assignment</label>
                <select required className="input-field" value={editWbsProj} onChange={e=>setEditWbsProj(e.target.value)}>
                  {projects.map(p => (
                    <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">WBS Description</label>
                <input type="text" className="input-field" value={editWbsDesc} onChange={e=>setEditWbsDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingWbs(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {editingDept && (
        <div className="modal-overlay" onClick={() => setEditingDept(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit Department: {editingDept.name}</h3>
              <button onClick={() => setEditingDept(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditDept} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input type="text" required className="input-field" value={editDeptName} onChange={e=>setEditDeptName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="input-field" value={editDeptDesc} onChange={e=>setEditDeptDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingDept(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCostCenter && (
        <div className="modal-overlay" onClick={() => setEditingCostCenter(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit Cost Center: {editingCostCenter.code}</h3>
              <button onClick={() => setEditingCostCenter(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditCostCenter} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Cost Center Name</label>
                <input type="text" required className="input-field" value={editCostCenterName} onChange={e => setEditCostCenterName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="input-field" value={editCostCenterDesc} onChange={e => setEditCostCenterDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingCostCenter(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Edit User: {editingUser.username}</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" required className="input-field" value={editUserName} onChange={e=>setEditUserName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" required className="input-field" value={editUserEmail} onChange={e=>setEditUserEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input type="text" className="input-field" value={editUserMobile} onChange={e=>setEditUserMobile(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select required className="input-field" value={editUserRole} onChange={e=>setEditUserRole(e.target.value)}>
                  <option value="Admin">Admin</option>
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Warehouse Supervisor">Warehouse Supervisor</option>
                  <option value="Warehouse Worker">Warehouse Worker</option>
                  <option value="Requestor">Requestor</option>
                  <option value="Requestor Manager">Requestor Manager</option>
                </select>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="editUserActiveCheck" checked={editUserActive} onChange={e=>setEditUserActive(e.target.checked)} />
                <label htmlFor="editUserActiveCheck" className="form-label" style={{ cursor: 'pointer', margin: 0 }}>Active Account</label>
              </div>
              <div className="form-group">
                <label className="form-label">Reset Password (leave blank to keep current)</label>
                <input type="password" className="input-field" value={editUserPassword} onChange={e=>setEditUserPassword(e.target.value)} placeholder="New password" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Inspector Modal */}
      {inspectingStockType && (
        <div className="modal-overlay" onClick={() => setInspectingStockType(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} style={{ color: 'var(--primary)' }} />
                {inspectingStockTitle}
              </h3>
              <button onClick={() => setInspectingStockType(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            {inspectingStockLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading stock records...</div>
            ) : inspectingStockData.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active stock records found for this selection.</div>
            ) : (
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Description</th>
                      <th>Plant / Storage Loc</th>
                      <th>WBS Element</th>
                      <th style={{ textAlign: 'right' }}>Available Qty</th>
                      <th style={{ textAlign: 'right' }}>Blocked Qty</th>
                      <th style={{ textAlign: 'right' }}>Stock Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectingStockData.map(st => (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 600 }}>{st.material_code}</td>
                        <td>{st.description}</td>
                        <td>{st.plant_code} / {st.storage_location_code}</td>
                        <td>{st.wbs_code || 'N/A'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {st.available_qty} {st.uom}
                        </td>
                        <td style={{ textAlign: 'right', color: st.blocked_qty > 0 ? 'var(--danger)' : 'inherit' }}>
                          {st.blocked_qty} {st.uom}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>
                          ${st.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setInspectingStockType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default CompanySetup;
