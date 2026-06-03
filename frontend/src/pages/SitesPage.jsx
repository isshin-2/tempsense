import { useState, useEffect } from 'react';
import { fetchSites, createSite, updateSite, deleteSite } from '../services/api';
import { Building2, Plus, Trash2, MapPin, Pencil } from 'lucide-react';

export default function SitesPage() {
  const [sites, setSites] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', accountId: 1 });

  useEffect(() => { loadSites(); }, []);

  async function loadSites() {
    try { setSites(await fetchSites()); } catch (err) { console.error(err); }
  }

  function openCreate() {
    setEditId(null);
    setForm({ name: '', location: '', accountId: 1 });
    setShowModal(true);
  }

  function openEdit(site) {
    setEditId(site.id);
    setForm({ name: site.name, location: site.location || '' });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editId) {
        await updateSite(editId, { name: form.name, location: form.location });
      } else {
        await createSite(form);
      }
      setShowModal(false);
      loadSites();
    } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this site and all its rooms/nodes?')) return;
    try { await deleteSite(id); loadSites(); } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h2>Sites</h2>
          <p>Manage warehouse and facility locations</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Site
        </button>
      </div>

      <div className="page-body">
        {sites.length === 0 ? (
          <div className="text-center mt-24" style={{ color: 'var(--text-muted)' }}>
            <Building2 size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No sites configured yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Location</th>
                <th>Organization</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={14} style={{ color: 'var(--accent-amber)' }} />
                      {s.name}
                    </div>
                  </td>
                  <td>{s.location || '--'}</td>
                  <td>{s.account_name}</td>
                  <td>{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit Site' : 'Add New Site'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Site Name</label>
                <input className="form-input" placeholder="e.g. Warehouse Alpha - Chennai"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input className="form-input" placeholder="e.g. Chennai, Tamil Nadu"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit">{editId ? 'Save Changes' : 'Create Site'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
