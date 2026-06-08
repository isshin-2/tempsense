import { useState, useEffect } from 'react';
import { 
  fetchSMTP, updateSMTP, testSMTP,
  fetchUpdateStatus, checkUpdates, installUpdate, saveUpdateConfig, runSystemDiagnostics
} from '../services/api';
import { 
  Mail, Shield, Save, Send, Loader2, CheckCircle, XCircle,
  RefreshCw, GitBranch, Play, AlertCircle, Activity
} from 'lucide-react';

export default function SettingsPage() {
  const [smtp, setSmtp] = useState({
    use_custom: false, host: '', port: 587, user_email: '', password: '', secure: false, sender_name: 'Tempsense Alerts'
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  // Update states
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState('');
  const [rebooting, setRebooting] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);


  useEffect(() => {
    fetchSMTP().then(data => {
      if (data) setSmtp({ ...data, password: '' }); // Don't show password
    }).catch(console.error);

    loadUpdateStatus();
  }, []);

  async function loadUpdateStatus() {
    setUpdateLoading(true);
    setUpdateError(null);
    try {
      const data = await fetchUpdateStatus();
      setUpdateInfo(data);
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }

  async function handleToggleAutoCheck(enabled) {
    setSavingConfig(true);
    try {
      await saveUpdateConfig(enabled, updateInfo?.config?.autoUpdateInterval || 24);
      setUpdateInfo(prev => ({
        ...prev,
        config: {
          ...prev.config,
          autoUpdateEnabled: enabled
        }
      }));
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleCheckUpdates() {
    setChecking(true);
    setUpdateError(null);
    try {
      const data = await checkUpdates();
      setUpdateInfo(prev => ({
        ...prev,
        git: data
      }));
      if (data.updateAvailable) {
        setStatus({ type: 'success', message: 'A new update is available!' });
      } else {
        setStatus({ type: 'success', message: 'System is up to date.' });
      }
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleInstallUpdate() {
    if (!window.confirm('Are you sure you want to update and restart the server? The server will be temporarily offline for 10-30 seconds.')) {
      return;
    }
    setInstalling(true);
    setInstallStatus('Pulling changes and checking dependencies...');
    setDiagnosticsResults(null);
    
    try {
      const res = await installUpdate();
      setInstallStatus(res.message || 'Update installed successfully. Server is restarting...');
      
      // Start polling for server health
      setTimeout(() => {
        setInstalling(false);
        setRebooting(true);
        pollServerHealth();
      }, 2000);
      
    } catch (err) {
      setInstalling(false);
      setStatus({ type: 'error', message: 'Failed to install updates: ' + err.message });
    }
  }

  async function pollServerHealth() {
    const maxAttempts = 30;
    let attempt = 0;
    
    const interval = setInterval(async () => {
      attempt++;
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          clearInterval(interval);
          setRebooting(false);
          setStatus({ type: 'success', message: 'Server successfully restarted!' });
          handleRunDiagnostics();
        }
      } catch (e) {
        if (attempt >= maxAttempts) {
          clearInterval(interval);
          setRebooting(false);
          setStatus({ type: 'error', message: 'Server did not come back online in time. Please check backend logs.' });
        }
      }
    }, 1500);
  }

  async function handleRunDiagnostics() {
    setDiagnosing(true);
    setDiagnosticsResults(null);
    try {
      const data = await runSystemDiagnostics();
      setDiagnosticsResults(data);
      if (data.success) {
        setStatus({ type: 'success', message: 'Self-diagnostics completed. All services healthy!' });
      } else {
        setStatus({ type: 'error', message: 'Self-diagnostics failed. Please check backend details below.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Diagnostics suite failed to run: ' + err.message });
    } finally {
      setDiagnosing(false);
    }
  }

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
        <div className="flex items-center gap-3 mb-24">
          <RefreshCw className="text-primary" size={24} />
          <div>
            <h3 className="m-0">System Updates &amp; Diagnostics</h3>
            <p className="text-muted text-sm m-0">Monitor git revisions, check server health, and deploy updates</p>
          </div>
        </div>

        {rebooting ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px dashed rgba(59, 130, 246, 0.2)',
            borderRadius: '12px'
          }}>
            <Loader2 className="animate-spin text-primary mx-auto mb-16" size={48} />
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Server Reconnecting...</h4>
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              The server is applying updates and restarting. This page will automatically reconnect and run diagnostics once the backend is online.
            </p>
          </div>
        ) : installing ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px dashed rgba(245, 158, 11, 0.2)',
            borderRadius: '12px'
          }}>
            <Loader2 className="animate-spin text-warning mx-auto mb-16" size={48} />
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Applying Server Update...</h4>
            <p className="text-sm text-muted" style={{ margin: 0 }}>{installStatus}</p>
          </div>
        ) : updateLoading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : updateError ? (
          <div className="alert alert-error p-16 rounded shadow-sm" style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #f87171' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={20} />
              <span className="text-sm font-medium">Error checking updates: {updateError}</span>
            </div>
            <button className="btn btn-ghost mt-12 btn-xs" type="button" onClick={loadUpdateStatus} style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>Retry</button>
          </div>
        ) : (
          <div>
            {/* Git Revision Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <GitBranch size={16} className="text-muted" />
                  <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Version</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                  Branch: <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{updateInfo?.git?.branch || 'main'}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Commit: <span style={{ fontFamily: 'monospace' }}>{updateInfo?.git?.currentHash || 'unknown'}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.8, marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                  {updateInfo?.git?.commitMessage ? `"${updateInfo.git.commitMessage}"` : ''} ({updateInfo?.git?.commitDate || 'N/A'})
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <RefreshCw size={16} className="text-muted" />
                  <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Update Status</span>
                </div>
                {updateInfo?.git?.updateAvailable ? (
                  <div>
                    <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                      Update Available
                    </span>
                    <div className="text-xs text-muted mt-8">
                      Remote origin has new updates.
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="badge badge-success" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                      Up to Date
                    </span>
                    <div className="text-xs text-muted mt-8">
                      Your server is running the latest commits.
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '14px' }}>
                  Last Checked: {updateInfo?.config?.lastUpdateCheck ? new Date(updateInfo.config.lastUpdateCheck).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>

            {/* Commits Behind List */}
            {updateInfo?.git?.updateAvailable && updateInfo?.git?.commitsBehind?.length > 0 && (
              <div style={{
                background: 'rgba(15, 23, 40, 0.5)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '20px'
              }}>
                <h4 style={{ fontSize: '13px', margin: '0 0 10px 0', color: 'var(--text-primary)' }}>New Commits to Pull:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {updateInfo.git.commitsBehind.map((commit, idx) => (
                    <li key={idx}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--primary)', marginRight: '6px' }}>{commit.hash}</span>
                      {commit.msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Configuration */}
            <div className="form-group flex items-center gap-2 mb-20" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <input type="checkbox" id="autoCheckUpdates" 
                checked={updateInfo?.config?.autoUpdateEnabled}
                onChange={e => handleToggleAutoCheck(e.target.checked)}
                disabled={savingConfig}
              />
              <label htmlFor="autoCheckUpdates" style={{ fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', userSelect: 'none' }}>
                Enable Automatic Background Update Checking
              </label>
              {savingConfig && <Loader2 size={14} className="animate-spin text-muted" />}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-12 mt-20" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" type="button" onClick={handleCheckUpdates} disabled={checking} style={{ width: 'auto' }}>
                {checking ? <Loader2 size={16} className="animate-spin mr-8" /> : <RefreshCw size={16} className="mr-8" />}
                Check Now
              </button>
              {updateInfo?.git?.updateAvailable && (
                <button className="btn btn-primary" type="button" onClick={handleInstallUpdate} style={{ width: 'auto', backgroundColor: '#d97706', borderColor: '#d97706', color: '#fff' }}>
                  <Play size={16} className="mr-8" />
                  Install Update Now
                </button>
              )}
              <button className="btn btn-ghost" type="button" onClick={handleRunDiagnostics} disabled={diagnosing} style={{ width: 'auto', border: '1px solid var(--border-subtle)', background: 'transparent' }}>
                {diagnosing ? <Loader2 size={16} className="animate-spin mr-8" /> : <Activity size={16} className="mr-8" />}
                Run Diagnostics
              </button>
            </div>

            {/* Diagnostics Results List */}
            {diagnosticsResults && (
              <div style={{
                marginTop: '24px',
                padding: '20px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.01)',
                border: `1px solid ${diagnosticsResults.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    <Activity size={16} className={diagnosticsResults.success ? 'text-success' : 'text-danger'} />
                    Self-Diagnostics Report
                  </h4>
                  <span className="text-xs text-muted">{new Date(diagnosticsResults.timestamp).toLocaleTimeString()}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(diagnosticsResults.results).map(([key, res]) => {
                    const label = {
                      database: 'PostgreSQL Database Connection',
                      tcpServer: 'TCP Sensor Ingestion listener (Port 1024)',
                      smtp: 'SMTP E-mail Notification Gateway',
                      mdns: 'mDNS Local Network Discovery'
                    }[key] || key;

                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13.5px' }}>
                        {res.ok ? (
                          <CheckCircle className="text-success mt-2" size={16} style={{ flexShrink: 0, color: '#22c55e' }} />
                        ) : (
                          <XCircle className="text-danger mt-2" size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{label}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{res.message}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
