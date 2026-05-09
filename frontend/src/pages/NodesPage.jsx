import { useState, useEffect } from 'react';
import { fetchNodes, fetchRooms, createNode, deleteNode } from '../services/api';
import { Cpu, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';

export default function NodesPage() {
  const [nodes, setNodes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    roomId: '', deviceId: '', name: '', ipAddress: '',
    tcpPort: 8080, samplingInterval: 5,
    tempHigh: 30, tempLow: 2, humidityHigh: 80, humidityLow: 20,
  });

  useEffect(() => {
    loadNodes();
    fetchRooms().then(setRooms).catch(console.error);
  }, []);

  async function loadNodes() {
    try { setNodes(await fetchNodes()); } catch (err) { console.error(err); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createNode(form);
      setShowModal(false);
      setForm({
        roomId: '', deviceId: '', name: '', ipAddress: '',
        tcpPort: 8080, samplingInterval: 5,
        tempHigh: 30, tempLow: 2, humidityHigh: 80, humidityLow: 20,
      });
      loadNodes();
    } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this node and all its data?')) return;
    try { await deleteNode(id); loadNodes(); } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h2>Sensor Nodes</h2>
          <p>IoT hardware units mapped to rooms</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Node
        </button>
      </div>

      <div className="page-body">
        {nodes.length === 0 ? (
          <div className="text-center mt-24" style={{ color: 'var(--text-muted)' }}>
            <Cpu size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No nodes configured. Create a room first.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Node Name</th>
                <th>Device ID</th>
                <th>Room</th>
                <th>Site</th>
                <th>IP</th>
                <th>Temp Range</th>
                <th>Humidity Range</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => {
                const lastSeen = n.last_seen ? new Date(n.last_seen) : null;
                const staleMin = lastSeen ? (Date.now() - lastSeen.getTime()) / 60000 : Infinity;
                const online = staleMin < 2;
                return (
                  <tr key={n.id}>
                    <td>{online ? <Wifi size={14} style={{ color: 'var(--accent-green)' }} /> : <WifiOff size={14} style={{ color: 'var(--accent-red)' }} />}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.name}</td>
                    <td>{n.device_id}</td>
                    <td>{n.room_name}</td>
                    <td>{n.site_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{n.ip_address || '--'}</td>
                    <td>{n.temp_low}° — {n.temp_high}°C</td>
                    <td>{n.humidity_low}% — {n.humidity_high}%</td>
                    <td style={{ fontSize: '12px' }}>
                      {lastSeen ? lastSeen.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(n.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3>Add Sensor Node</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Room</label>
                <select className="form-input" value={form.roomId}
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })} required>
                  <option value="">Select Room</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.site_name} → {r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Node Name</label>
                  <input className="form-input" placeholder="e.g. TMS Node 1"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Device ID</label>
                  <input className="form-input" type="number" placeholder="e.g. 1"
                    value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: parseInt(e.target.value) || '' })} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>IP Address (optional)</label>
                  <input className="form-input" placeholder="192.168.1.x"
                    value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Sampling (sec)</label>
                  <input className="form-input" type="number"
                    value={form.samplingInterval} onChange={(e) => setForm({ ...form, samplingInterval: parseInt(e.target.value) || 5 })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Temp Low (°C)</label>
                  <input className="form-input" type="number" step="0.1"
                    value={form.tempLow} onChange={(e) => setForm({ ...form, tempLow: parseFloat(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Temp High (°C)</label>
                  <input className="form-input" type="number" step="0.1"
                    value={form.tempHigh} onChange={(e) => setForm({ ...form, tempHigh: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Humidity Low (%)</label>
                  <input className="form-input" type="number" step="0.1"
                    value={form.humidityLow} onChange={(e) => setForm({ ...form, humidityLow: parseFloat(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Humidity High (%)</label>
                  <input className="form-input" type="number" step="0.1"
                    value={form.humidityHigh} onChange={(e) => setForm({ ...form, humidityHigh: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit">Create Node</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
