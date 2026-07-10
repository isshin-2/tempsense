import { useState, useEffect } from 'react';
import { fetchHistory, fetchSites, fetchRooms, fetchNodes, exportPDF, exportCSV } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, FileText, Download } from 'lucide-react';

export default function ReportsPage() {
  const [sites, setSites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    siteId: '',
    roomId: '',
    nodeId: '',
    startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    excludeAlerts: false,
    excludeOnboard: false,
  });

  useEffect(() => {
    fetchSites().then(setSites).catch(console.error);
  }, []);

  useEffect(() => {
    if (filters.siteId) {
      fetchRooms(filters.siteId).then(setRooms).catch(console.error);
    }
  }, [filters.siteId]);

  useEffect(() => {
    if (filters.roomId) {
      fetchNodes(filters.roomId).then(setNodes).catch(console.error);
    }
  }, [filters.roomId]);

  async function handleQuery() {
    if (!filters.siteId) return alert('Please select a site');
    setLoading(true);
    try {
      const data = await fetchHistory({
        siteId: filters.siteId,
        roomId: filters.roomId || undefined,
        nodeId: filters.nodeId || undefined,
        startDate: filters.startDate,
        endDate: filters.endDate + 'T23:59:59',
        limit: 500,
        excludeAlerts: filters.excludeAlerts,
      });
      setHistory(data.reverse());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function handlePDF() {
    if (!filters.siteId) return alert('Please select a site');
    exportPDF({
      siteId: filters.siteId,
      roomId: filters.roomId || '',
      nodeId: filters.nodeId || '',
      startDate: filters.startDate,
      endDate: filters.endDate + 'T23:59:59',
      excludeAlerts: filters.excludeAlerts,
      excludeOnboard: filters.excludeOnboard,
    });
  }

  function handleCSV() {
    if (!filters.siteId) return alert('Please select a site');
    exportCSV({
      siteId: filters.siteId,
      roomId: filters.roomId || '',
      nodeId: filters.nodeId || '',
      startDate: filters.startDate,
      endDate: filters.endDate + 'T23:59:59',
      excludeAlerts: filters.excludeAlerts,
      excludeOnboard: filters.excludeOnboard,
    });
  }

  // Prepare chart data
  const chartData = history.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    T1: r.t1,
    T2: r.t2,
    DHT: r.td,
    Humidity: r.humidity,
  }));

  // Resolve dynamic sensor names if a node is selected (or use defaults)
  const selectedNodeObj = nodes.find(n => String(n.id) === String(filters.nodeId));
  const t1Label = selectedNodeObj?.t1_name || 'DS18 #1';
  const t2Label = selectedNodeObj?.t2_name || 'DS18 #2';
  const tdLabel = selectedNodeObj?.td_name || 'DHT Temp';
  const humLabel = selectedNodeObj?.humidity_name || 'Humidity';

  return (
    <>
      <div className="page-header">
        <h2>Reports & Analytics</h2>
        <p>Historical data, charts, and ISO-compliant PDF exports</p>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Site</label>
            <select className="form-input" value={filters.siteId}
              onChange={(e) => setFilters({ ...filters, siteId: e.target.value, roomId: '', nodeId: '' })}>
              <option value="">Select Site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Room</label>
            <select className="form-input" value={filters.roomId}
              onChange={(e) => setFilters({ ...filters, roomId: e.target.value, nodeId: '' })}>
              <option value="">All Rooms</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Node</label>
            <select className="form-input" value={filters.nodeId}
              onChange={(e) => setFilters({ ...filters, nodeId: e.target.value })}>
              <option value="">All Nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Start Date</label>
            <input className="form-input" type="date" value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>End Date</label>
            <input className="form-input" type="date" value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <div className="form-group flex items-center gap-2" style={{ margin: 0, alignSelf: 'end', paddingBottom: '8px' }}>
            <input type="checkbox" id="excludeAlerts" checked={filters.excludeAlerts}
              onChange={(e) => setFilters({ ...filters, excludeAlerts: e.target.checked })} />
            <label htmlFor="excludeAlerts" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, userSelect: 'none' }}>
              Exclude Breaches
            </label>
          </div>
          <div className="form-group flex items-center gap-2" style={{ margin: 0, alignSelf: 'end', paddingBottom: '8px' }}>
            <input type="checkbox" id="excludeOnboard" checked={filters.excludeOnboard}
              onChange={(e) => setFilters({ ...filters, excludeOnboard: e.target.checked })} />
            <label htmlFor="excludeOnboard" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, userSelect: 'none' }}>
              Exclude Onboard Sensors (DHT22)
            </label>
          </div>
        </div>

        <div className="flex gap-12 mb-16">
          <button className="btn btn-primary" onClick={handleQuery} disabled={loading}>
            <BarChart3 size={16} /> {loading ? 'Loading...' : 'Query Data'}
          </button>
          <button className="btn btn-ghost" onClick={handlePDF}>
            <FileText size={16} /> Export PDF
          </button>
          <button className="btn btn-ghost" onClick={handleCSV}>
            <Download size={16} /> Export CSV
          </button>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>Temperature & Humidity Trend</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="T1" stroke="#3b82f6" strokeWidth={2} dot={false} name={t1Label} />
                <Line type="monotone" dataKey="T2" stroke="#06b6d4" strokeWidth={2} dot={false} name={t2Label} />
                <Line type="monotone" dataKey="DHT" stroke="#f59e0b" strokeWidth={2} dot={false} name={tdLabel} />
                <Line type="monotone" dataKey="Humidity" stroke="#8b5cf6" strokeWidth={2} dot={false} name={`${humLabel} %`} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data Table */}
        {history.length > 0 && (
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              Data Log ({history.length} readings)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Node</th>
                    <th>Room</th>
                    <th>{t1Label} °C</th>
                    <th>{t2Label} °C</th>
                    <th>{tdLabel} °C</th>
                    <th>{humLabel} %</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '12px' }}>
                        {new Date(r.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td>{r.node_name}</td>
                      <td>{r.room_name}</td>
                      <td>{r.t1 !== null ? r.t1.toFixed(1) : '--'}</td>
                      <td>{r.t2 !== null ? r.t2.toFixed(1) : '--'}</td>
                      <td>{r.td !== null ? r.td.toFixed(1) : '--'}</td>
                      <td>{r.humidity !== null ? r.humidity.toFixed(1) : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {history.length === 0 && !loading && (
          <div className="text-center mt-24" style={{ color: 'var(--text-muted)' }}>
            <BarChart3 size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>Select a site and date range, then click "Query Data"</p>
          </div>
        )}
      </div>
    </>
  );
}
