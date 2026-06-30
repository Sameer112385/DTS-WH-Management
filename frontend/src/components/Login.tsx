import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { CompanySetting } from '../types';

interface LoginProps {
  onLogin: (token: string) => void;
  apiBase: string;
  companySetting: CompanySetting | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, apiBase, companySetting }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Login failed. Invalid username or password.');
      }

      const data = await res.json();
      onLogin(data.access_token);
    } catch (err: any) {
      setError(err.message || 'Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const selectQuickRole = (role: string) => {
    const name = role.toLowerCase().replace(' ', '');
    setUsername(name);
    setPassword(name + '123');
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1e1b4b 0%, #090514 100%)',
      padding: '1.5rem'
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '460px',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '140px',
          height: '4px',
          background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          borderRadius: '2px'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {companySetting?.company_logo ? (
            <img
              src={companySetting.company_logo}
              alt={companySetting.company_name}
              style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain', marginBottom: '1.25rem' }}
            />
          ) : (
            <div style={{
              display: 'inline-flex',
              width: '60px',
              height: '60px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary), #818cf8)',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: '1rem',
              boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)'
            }}>
              <Shield size={28} />
            </div>
          )}
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {companySetting?.company_name || 'Warehouse Log'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Authenticate to access stock ledger
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <UserIcon size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center', padding: '0.8rem' }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'left'
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Testing Role Shortcuts
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              'Admin',
              'Warehouse Manager',
              'Warehouse Supervisor',
              'Warehouse Worker',
              'Requestor',
              'Requestor Manager'
            ].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => selectQuickRole(r)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
