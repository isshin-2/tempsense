import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { setupProfile } from '../services/api';
import { Thermometer, User, Phone, Building2, Loader2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileSetup() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', phone: '', companyName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [firstAdmin, setFirstAdmin] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Full name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await setupProfile(form);
      localStorage.setItem('tempsense_token', res.token);
      localStorage.setItem('tempsense_user', JSON.stringify(res.user));
      updateUser(res.user);
      if (res.firstAdmin) setFirstAdmin(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '460px' }}>
        <div className="login-brand">
          <Thermometer size={32} style={{ color: '#3b82f6' }} />
          <h1>TEMPSENSE</h1>
          <p>Complete Your Profile</p>
        </div>

        {firstAdmin && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981'
          }}>
            <Shield size={20} />
            <span style={{ fontSize: '13px' }}>You are the first user — <strong>Admin</strong> role assigned automatically!</span>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={14} /> Company / Organization Name
            </label>
            <input className="form-input" placeholder="e.g. Maxworth Techserv Pvt Ltd"
              value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>This will appear on the dashboard header</span>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> Full Name
            </label>
            <input className="form-input" placeholder="e.g. Krithik Srinivasan"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={14} /> Contact Number
            </label>
            <input className="form-input" placeholder="+91 98765 43210" type="tel"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> Setting up...</>
              : 'Complete Setup'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
          Maxworth Techserv • Cold Chain IoT Platform
        </p>
      </div>
    </div>
  );
}
