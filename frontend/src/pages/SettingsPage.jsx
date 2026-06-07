import { useState, useEffect } from 'react';
import { fetchSMTP, updateSMTP, testSMTP } from '../services/api';
import { Mail, Shield, Save, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function SettingsPage() {
  const [smtp, setSmtp] = useState({
    use_custom: false, host: '', port: 587, user_email: '', password: '', secure: false, sender_name: 'Tempsense Alerts'
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    fetchSMTP().then(data => {
      if (data) setSmtp({ ...data, password: '' }); // Don't show password
    }).catch(console.error);
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await updateSMTP(smtp);
      setStatus({ type: 'success', message: 'SMTP settings saved successfully' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    try {
      const res = await testSMTP();
      setStatus({ type: 'success', message: res.message || 'Connection successful!' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <h2>System Settings</h2>
        <p>Configure global parameters and email services</p>
      </div>

      <div className="card mt-24">
        <div className="flex items-center gap-3 mb-24">
          <Mail className="text-primary" size={24} />
          <div>
            <h3 className="m-0">SMTP Email Configuration</h3>
            <p className="text-muted text-sm m-0">Used for automated alerts and scheduled reports</p>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group flex items-center gap-2 mb-24" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
            <input type="checkbox" id="useCustomSmtp" checked={smtp.use_custom}
              onChange={e => setSmtp({ ...smtp, use_custom: e.target.checked })} />
            <label htmlFor="useCustomSmtp" style={{ fontWeight: 600, fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}>
              Configure Custom SMTP Server
            </label>
          </div>

          <div className="form-group">
            <label>Sender Name</label>
            <input className="form-input" placeholder="Tempsense Alerts"
              value={smtp.sender_name} onChange={e => setSmtp({ ...smtp, sender_name: e.target.value })} required />
          </div>

          {smtp.use_custom ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>SMTP Host</label>
                  <input className="form-input" placeholder="smtp.gmail.com"
                    value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input className="form-input" type="number" placeholder="587"
                    value={smtp.port} onChange={e => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })} required />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input className="form-input" type="email" placeholder="alerts@company.com"
                  value={smtp.user_email} onChange={e => setSmtp({ ...smtp, user_email: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Password / App Password</label>
                <input className="form-input" type="password" placeholder="••••••••••••"
                  value={smtp.password} onChange={e => setSmtp({ ...smtp, password: e.target.value })} 
                  required={smtp.use_custom && !smtp.host}
                />
                <p className="text-xs text-muted mt-4">Leave blank if you don't want to change the existing password.</p>
              </div>

              <div className="form-group flex items-center gap-2">
                <input type="checkbox" id="smtpSecure" checked={smtp.secure}
                  onChange={e => setSmtp({ ...smtp, secure: e.target.checked })} />
                <label htmlFor="smtpSecure" style={{ cursor: 'pointer', userSelect: 'none' }}>Use SSL/TLS (Secure Connection)</label>
              </div>
            </>
          ) : (
            <div style={{
              background: 'rgba(59, 130, 246, 0.06)',
              padding: '16px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              lineHeight: 1.5,
              marginBottom: '24px'
            }}>
              <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>System Default SMTP Enabled</strong>
              The system is currently configured to send alerts and reports using the default, secure Maxworth Techserv email server. SMTP host credentials and passwords are kept hidden for security.
            </div>
          )}

          {status && (
            <div className={`alert alert-${status.type} flex items-center gap-2 mb-16 p-12 rounded`} 
                 style={{ backgroundColor: status.type === 'success' ? '#ecfdf5' : '#fef2f2', 
                          color: status.type === 'success' ? '#065f46' : '#991b1b',
                          border: `1px solid ${status.type === 'success' ? '#10b981' : '#f87171'}` }}>
              {status.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span className="text-sm">{status.message}</span>
            </div>
          )}

          <div className="flex gap-12 mt-24">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-8" /> : <Save size={16} className="mr-8" />}
              Save Configuration
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleTest} disabled={testing || (smtp.use_custom && !smtp.host)}>
              {testing ? <Loader2 size={16} className="animate-spin mr-8" /> : <Send size={16} className="mr-8" />}
              Test Connection
            </button>
          </div>
        </form>
      </div>

      <div className="card mt-24">
        <div className="flex items-center gap-3 mb-16">
          <Shield className="text-primary" size={24} />
          <h3 className="m-0">Security Note</h3>
        </div>
        <p className="text-sm text-muted">
          SMTP passwords are stored encrypted in the database. Ensure you use App Passwords for services like Gmail for better security.
        </p>
      </div>
    </div>
  );
}
