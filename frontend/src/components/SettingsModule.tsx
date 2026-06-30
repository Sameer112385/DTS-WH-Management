import React, { useState, useEffect } from 'react';
import { Settings, Mail, ShieldCheck, AlertCircle, RefreshCw, Building2 } from 'lucide-react';
import { EmailSetting, CompanySetting, User } from '../types';
import ModuleDataTools from './ModuleDataTools';

interface SettingsProps {
  apiBase: string;
  token: string;
  onRefresh: () => void;
  companySetting: CompanySetting | null;
  user: User | null;
}

const SettingsModule: React.FC<SettingsProps> = ({
  apiBase,
  token,
  onRefresh,
  companySetting,
  user
}) => {
  const [smtpServer, setSmtpServer] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [imapServer, setImapServer] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [exchangeServer, setExchangeServer] = useState('');
  const [sslTls, setSslTls] = useState(true);
  const [emailApprovalEnabled, setEmailApprovalEnabled] = useState(false);

  const [activeTab, setActiveTab] = useState<'email' | 'company'>('company');

  // Company settings states
  const [companyName, setCompanyName] = useState('WAREHOUSE');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPlant, setCompanyPlant] = useState('');
  const [companyCurrency, setCompanyCurrency] = useState('USD');
  const [companyLocation, setCompanyLocation] = useState('');
  const [companyCalendar, setCompanyCalendar] = useState('');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (companySetting) {
      setCompanyName(companySetting.company_name || 'WAREHOUSE');
      setCompanyLogo(companySetting.company_logo || null);
      setCompanyAddress(companySetting.address || '');
      setCompanyPlant(companySetting.plant || '');
      setCompanyCurrency(companySetting.currency || 'USD');
      setCompanyLocation(companySetting.location || '');
      setCompanyCalendar(companySetting.calendar || '');
    }
  }, [companySetting]);

  useEffect(() => {
    // Fetch email settings
    fetch(`${apiBase}/settings/email`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then((data: EmailSetting) => {
        setSmtpServer(data.smtp_server || '');
        setSmtpPort(data.smtp_port || 465);
        setUsername(data.username || '');
        setSenderEmail(data.sender_email || '');
        setImapServer(data.imap_server || '');
        setImapPort(data.imap_port || 993);
        setExchangeServer(data.exchange_server || '');
        setSslTls(data.ssl_tls);
        setEmailApprovalEnabled(data.email_approval_enabled);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${apiBase}/settings/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          smtp_server: smtpServer,
          smtp_port: parseInt(smtpPort.toString()),
          username,
          password: password || undefined, // Don't send empty password if unchanged
          sender_email: senderEmail,
          imap_server: imapServer,
          imap_port: parseInt(imapPort.toString()),
          exchange_server: exchangeServer,
          ssl_tls: sslTls,
          email_approval_enabled: emailApprovalEnabled
        })
      });

      if (!res.ok) throw new Error('Failed to update email configurations.');
      
      setIsSuccess(true);
      setStatusMsg('Email configurations updated successfully!');
      onRefresh();
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || 'Saving settings failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${apiBase}/settings/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          smtp_server: smtpServer,
          smtp_port: parseInt(smtpPort.toString()),
          username,
          password: password || undefined,
          sender_email: senderEmail,
          imap_server: imapServer,
          imap_port: parseInt(imapPort.toString()),
          exchange_server: exchangeServer,
          ssl_tls: sslTls,
          email_approval_enabled: emailApprovalEnabled
        })
      });

      const data = await res.json();
      setIsSuccess(data.success);
      setStatusMsg(data.message);
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || 'SMTP Connection test failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("Logo image is too large. Please select an image under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompanyLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${apiBase}/settings/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          company_name: companyName,
          company_logo: companyLogo || null,
          address: companyAddress,
          plant: companyPlant,
          currency: companyCurrency,
          location: companyLocation,
          calendar: companyCalendar
        })
      });
      if (!res.ok) throw new Error('Failed to update company profile settings.');
      setIsSuccess(true);
      setStatusMsg('Company profile settings updated successfully!');
      onRefresh();
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || 'Saving company settings failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminReset = async () => {
    if (!window.confirm('This will clear stock, transactions, logs, masters, and users except the current admin. Continue?')) {
      return;
    }
    setResetBusy(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${apiBase}/admin-tools/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Reset failed.');
      setIsSuccess(true);
      setStatusMsg(data.message || 'Application reset completed.');
      onRefresh();
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || 'Reset failed.');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Tab bar header */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button 
          onClick={() => { setActiveTab('company'); setStatusMsg(''); }}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: activeTab === 'company' ? 'var(--primary-glow)' : 'transparent',
            color: activeTab === 'company' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'company' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-heading)',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={16} />
          Company Formation & Profile
        </button>
        <button 
          onClick={() => { setActiveTab('email'); setStatusMsg(''); }}
          style={{
            padding: '0.6rem 1.2rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: activeTab === 'email' ? 'var(--primary-glow)' : 'transparent',
            color: activeTab === 'email' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'email' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-heading)',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Mail size={16} />
          SMTP Email Configuration
        </button>
      </div>

      {statusMsg && (
        <div style={{
          backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          color: isSuccess ? 'var(--success)' : 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {isSuccess ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {activeTab === 'company' ? (
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} style={{ color: 'var(--primary)' }} />
              Company Setup & Formation Parameters
            </h3>

            <form onSubmit={handleSaveCompany} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input 
                    type="text" 
                    required 
                    className="input-field" 
                    value={companyName} 
                    onChange={e => setCompanyName(e.target.value)} 
                    placeholder="e.g. SAUDI STEEL CORP" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location / City</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={companyLocation} 
                    onChange={e => setCompanyLocation(e.target.value)} 
                    placeholder="e.g. Riyadh, Saudi Arabia" 
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Headquarters Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={companyAddress} 
                    onChange={e => setCompanyAddress(e.target.value)} 
                    placeholder="e.g. Industrial Zone, Phase 3, Bldg 42" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Plant Code / ID</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={companyPlant} 
                    onChange={e => setCompanyPlant(e.target.value)} 
                    placeholder="e.g. PL01" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Base Currency</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={companyCurrency} 
                    onChange={e => setCompanyCurrency(e.target.value)} 
                    placeholder="e.g. SAR or USD" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Calendar</label>
                  <select 
                    className="input-field" 
                    value={companyCalendar} 
                    onChange={e => setCompanyCalendar(e.target.value)}
                  >
                    <option value="">Select Workweek Calendar</option>
                    <option value="Gulf Workweek (Sun-Thu)">Gulf Workweek (Sun-Thu)</option>
                    <option value="Western Workweek (Mon-Fri)">Western Workweek (Mon-Fri)</option>
                    <option value="Continuous 24/7 Operations">Continuous 24/7 Operations</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Company Branding Logo</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="input-field" 
                    onChange={handleLogoUpload} 
                    style={{ paddingTop: '0.4rem' }}
                  />
                  {companyLogo && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img 
                        src={companyLogo} 
                        alt="Preview" 
                        style={{ maxHeight: '45px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', padding: '0.2rem', backgroundColor: 'rgba(255,255,255,0.02)' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setCompanyLogo(null)} 
                        style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        Remove Logo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.6rem 1.5rem' }}>
                  Save Company Settings
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} style={{ color: 'var(--primary)' }} />
              SMTP / IMAP Email System Setup
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">SMTP Server Host</label>
                  <input type="text" className="input-field" value={smtpServer} onChange={e=>setSmtpServer(e.target.value)} placeholder="smtp.gmail.com" />
                </div>

                <div className="form-group">
                  <label className="form-label">SMTP Port</label>
                  <input type="number" className="input-field" value={smtpPort} onChange={e=>setSmtpPort(parseInt(e.target.value) || 0)} placeholder="465" />
                </div>

                <div className="form-group">
                  <label className="form-label">SMTP Username (Email)</label>
                  <input type="email" className="input-field" value={username} onChange={e=>setUsername(e.target.value)} placeholder="warehouse@gmail.com" />
                </div>

                <div className="form-group">
                  <label className="form-label">SMTP Password / App Password</label>
                  <input type="password" className="input-field" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
                </div>

                <div className="form-group">
                  <label className="form-label">Sender Email Address</label>
                  <input type="email" className="input-field" value={senderEmail} onChange={e=>setSenderEmail(e.target.value)} placeholder="sender@company.com" />
                </div>

                <div className="form-group">
                  <label className="form-label">IMAP Server Host</label>
                  <input type="text" className="input-field" value={imapServer} onChange={e=>setImapServer(e.target.value)} placeholder="imap.gmail.com" />
                </div>

                <div className="form-group">
                  <label className="form-label">IMAP Port</label>
                  <input type="number" className="input-field" value={imapPort} onChange={e=>setImapPort(parseInt(e.target.value) || 0)} placeholder="993" />
                </div>

                <div className="form-group">
                  <label className="form-label">Exchange Web Service Endpoint</label>
                  <input type="text" className="input-field" value={exchangeServer} onChange={e=>setExchangeServer(e.target.value)} placeholder="outlook.office365.com" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" id="ssl-tls-check" checked={sslTls} onChange={e=>setSslTls(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="ssl-tls-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Require SSL/TLS connection security</label>
                </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" id="email-approval-check" checked={emailApprovalEnabled} onChange={e=>setEmailApprovalEnabled(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="email-approval-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Enable approval-stage email notifications</label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" disabled={loading} onClick={handleTestEmail} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  Test SMTP Connection
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save Setup
                </button>
              </div>

            </form>
          </div>
        )}

        {activeTab === 'company' ? (
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Company Parameters</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Specify the legal parameters, operational calendar, and logo branding configuration representing this organization.
            </p>
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <p>• <b>Branding Logo:</b> Replaces default icons in the sidebar and login portal. High contrast transparent PNG files are recommended.</p>
              <p>• <b>Plant ID:</b> Sets the headquarters plant code mapping for MB52 balance verification.</p>
              <p>• <b>Calendar week:</b> Dictates workweek days for auto-approving dispatches and shipping validation pipelines.</p>
            </div>
          </div>
        ) : (
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>SMTP Integration</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Configuring email enables immediate stock discrepancy alerts and approval emails sent to the Requestor Manager, Warehouse Supervisor, and Warehouse Manager.
            </p>
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <p>• <b>Gmail:</b> Use port 465 (SSL) or 587 (TLS). Generate a 16-character App Password inside Google Account settings.</p>
              <p>• <b>Office 365:</b> Host is <i>smtp.office365.com</i>, Port 587, with TLS security enabled.</p>
              <p>• <b>Test email:</b> Clicking 'Test SMTP Connection' will attempt to connect, login, and send a test message to the configured Sender Email.</p>
            </div>
          </div>
        )}

      </div>

      {user?.role === 'Admin' && (
        <div className="glass" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Admin Tools</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Reset the application data and export or import one full workbook for the entire system.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <ModuleDataTools apiBase={apiBase} token={token} moduleKey="all" onComplete={onRefresh} userRole={user?.role} />
            <button type="button" className="btn btn-danger" onClick={handleAdminReset} disabled={resetBusy}>
              {resetBusy ? 'Resetting...' : 'Reset Application'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .spin {
          animation: spinning 1s linear infinite;
        }
        @keyframes spinning {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SettingsModule;
