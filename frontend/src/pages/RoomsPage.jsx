import { useState, useEffect } from 'react';
import { fetchRooms, fetchSites, createRoom, deleteRoom } from '../services/api';
import { DoorOpen, Plus, Trash2 } from 'lucide-react';

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [sites, setSites] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ siteId: '', name: '' });

  useEffect(() => {
    loadRooms();
    fetchSites().then(setSites).catch(console.error);
  }, []);

  async function loadRooms() {
    try { setRooms(await fetchRooms()); } catch (err) { console.error(err); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createRoom(form);
      setShowModal(false);
      setForm({ siteId: '', name: '' });
      loadRooms();
    } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this room and all its nodes?')) return;
    try { await deleteRoom(id); loadRooms(); } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h2>Rooms</h2>
          <p>Cold storage chambers within your sites</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Room
        </button>
      </div>

      <div className="page-body">
        {rooms.length === 0 ? (
          <div className="text-center mt-24" style={{ color: 'var(--text-muted)' }}>
            <DoorOpen size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No rooms configured yet. Create a site first.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Room Name</th><th>Site</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                  <td>{r.site_name}</td>
                  <td>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                      <Trash2 size={14} />
                    </button>
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
            <h3>Add New Room</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Site</label>
                <select className="form-input" value={form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value })} required>
                  <option value="">Select Site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Room Name</label>
                <input className="form-input" placeholder="e.g. Deep Freezer 1"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit">Create Room</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
