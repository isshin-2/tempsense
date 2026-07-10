import { useState, useEffect } from 'react';
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule, fetchSites, testSchedule } from '../services/api';
import { Calendar, Plus, Trash2, Edit2, FileText, Loader2, Mail, Clock, Send } from 'lucide-react';

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState([]);
  const [sites, setSites] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [testingIds, setTestingIds] = useState({});

  const [form, setForm] = useState({
    name: '', frequency: 'daily', recipients: '', siteId: '', reportType: 'pdf', isActive: true,
    excludeAlerts: false, excludeOnboard: false
  });

  async function handleTestReport(id, name) {
    setTestingIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await testSchedule(id);
      alert(res.message || `Test report for "${name}" sent successfully!`);
      loadSchedules();
    } catch (err) {
      alert(`Test report failed: ${err.message}`);
    } finally {
      setTestingIds(prev => ({ ...prev, [id]: false }));
    }
  }

  useEffect(() => {
    loadSchedules();
    fetchSites().then(setSites).catch(console.error);
  }, []);

  async function loadSchedules() {
    setLoading(true);
    try { setSchedules(await fetchSchedules()); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, form);
      } else {
        await createSchedule(form);
      }
      setShowModal(false);
      resetForm();
      loadSchedules();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  function handleEdit(s) {
    setEditingSchedule(s);
    setForm({
      name: s.name,
      frequency: s.frequency,
      recipients: s.recipients,
      siteId: s.site_id,
      reportType: s.report_type,
      isActive: s.is_active,
      excludeAlerts: s.exclude_alerts || false,
      excludeOnboard: s.exclude_onboard || false
    });
    setShowModal(true);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this schedule?')) return;
    try { await deleteSchedule(id); loadSchedules(); } catch (err) { alert(err.message); }
  }

  function resetForm() {
    setForm({ 
      name: '', frequency: 'daily', recipients: '', siteId: '', reportType: 'pdf', isActive: true,
      excludeAlerts: false, excludeOnboard: false 
    });
    setEditingSchedule(null);
  }

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h2>Scheduled Reports</h2>
          <p>Automated PDF/CSV reports sent to your email</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={16} /> New Schedule
        </button>
      </div>

      <div className="page-body">
        {loading && schedules.length === 0 ? (
          <div className="text-center mt-24">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center mt-24 text-muted">
            <Calendar size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
            <p>No automated reports scheduled yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
            {schedules.map(s => (
              <div key={s.id} className="card relative">
                <div className="flex-between mb-16">
                  <div className="flex gap-8">
                    <span className={`badge badge-${s.is_active ? 'success' : 'ghost'}`}>
                      {s.is_active ? 'Active' : 'Paused'}
                    </span>
                    <span className="badge badge-info" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {s.report_type === 'both' ? 'PDF + CSV' : s.report_type?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm p-4" onClick={() => handleEdit(s)}><Edit2 size={14} /></button>
                    <button className="btn btn-ghost btn-sm p-4 text-danger" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <h3 className="mb-8">{s.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted mb-8">
                  <Clock size={14} /> <span>Frequency: <b>{s.frequency}</b></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted mb-8">
                  <FileText size={14} /> <span>Site: {s.site_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted mb-16">
                  <Mail size={14} /> <span className="truncate">To: {s.recipients}</span>
                </div>
                <div className="flex-between text-xs text-muted" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', alignItems: 'center' }}>
                  <span>Last run: {s.last_run ? new Date(s.last_run).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}</span>
                  <button className="btn btn-ghost btn-sm text-primary" style={{ height: 'auto', padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleTestReport(s.id, s.name)} disabled={testingIds[s.id]}>
                    {testingIds[s.id] ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    {testingIds[s.id] ? 'Sending...' : 'Test Run'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingSchedule ? 'Edit Schedule' : 'New Report Schedule'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Schedule Name</label>
                <input className="form-input" placeholder="e.g. Daily Facility Report"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Frequency</label>
                  <select className="form-input" value={form.frequency}
                    onChange={e => setForm({ ...form, frequency: e.target.value })}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Site</label>
                  <select className="form-input" value={form.siteId}
                    onChange={e => setForm({ ...form, siteId: e.target.value })} required>
                    <option value="">Select Site</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Recipients (Comma separated emails)</label>
                <input className="form-input" placeholder="admin@example.com, manager@example.com"
                  value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Report Format</label>
                <select className="form-input" value={form.reportType}
                  onChange={e => setForm({ ...form, reportType: e.target.value })}>
                  <option value="pdf">PDF Only</option>
                  <option value="csv">CSV Only</option>
                  <option value="both">Both PDF & CSV</option>
                </select>
              </div>

              <div className="form-group flex items-center gap-2">
                <input type="checkbox" id="srActive" checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="srActive">Schedule is Active</label>
              </div>

              <div className="form-group flex items-center gap-2">
                <input type="checkbox" id="srExcludeAlerts" checked={form.excludeAlerts}
                  onChange={e => setForm({ ...form, excludeAlerts: e.target.checked })} />
                <label htmlFor="srExcludeAlerts">Exclude breaches (Normal readings only)</label>
              </div>

              <div className="form-group flex items-center gap-2">
                <input type="checkbox" id="srExcludeOnboard" checked={form.excludeOnboard}
                  onChange={e => setForm({ ...form, excludeOnboard: e.target.checked })} />
                <label htmlFor="srExcludeOnboard">Exclude onboard sensors (DHT22 Temp/Hum)</label>
              </div>

              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading && <Loader2 size={14} className="animate-spin mr-2" />}
                  {editingSchedule ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
