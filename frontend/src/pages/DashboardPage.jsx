import { useState, useEffect, useRef } from 'react';
import { fetchLatest, fetchCompanyName, connectSocket, disconnectSocket, fetchCachedUpdateStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import SensorCard from '../components/SensorCard';
import GettingStarted from '../components/GettingStarted';
import { Activity, Thermometer, Droplets, AlertTriangle, Building2, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      fetchCachedUpdateStatus()
        .then(res => {
          if (res.updateAvailable) {
            setUpdateAvailable(true);
          }
        })
        .catch(err => console.error('Failed to check update status:', err));
    }
  }, [user]);

  useEffect(() => {
    loadData();

    // WebSocket for live updates
    const socket = connectSocket((data) => {
      setNodes((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((n) => n.node_id === data.nodeId);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            t1: data.t1,
            t2: data.t2,
            td: data.td,
            humidity: data.humidity,
            recorded_at: data.timestamp,
            last_seen: data.timestamp,
          };
        }
        return updated;
      });
    });

    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));

    // Periodic refresh
    const interval = setInterval(loadData, 30000);

    return () => {
      disconnectSocket();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchCompanyName().then(r => { if (r.companyName) setCompanyName(r.companyName); }).catch(() => {});
  }, []);

  async function loadData() {
    try {
      const data = await fetchLatest();
      setNodes(data);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }

  // Group nodes by site → room
  const grouped = {};
  for (const n of nodes) {
    const siteKey = n.site_name || 'Unknown Site';
    if (!grouped[siteKey]) grouped[siteKey] = {};
    const roomKey = n.room_name || 'Unknown Room';
    if (!grouped[siteKey][roomKey]) grouped[siteKey][roomKey] = [];
    grouped[siteKey][roomKey].push(n);
  }

  // Stats
  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => {
    const last = n.last_seen ? new Date(n.last_seen) : null;
    return last && (Date.now() - last.getTime()) < 120000;
  }).length;
  const alertNodes = nodes.filter((n) => {
    return (
      (n.t1 !== null && (n.t1 > n.temp_high || n.t1 < n.temp_low)) ||
      (n.t2 !== null && (n.t2 > n.temp_high || n.t2 < n.temp_low)) ||
      (n.td !== null && (n.td > n.temp_high || n.td < n.temp_low)) ||
      (n.humidity !== null && (n.humidity > n.humidity_high || n.humidity < n.humidity_low))
    );
  }).length;

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>Live Dashboard</h2>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 600,
              padding: '4px 10px', borderRadius: '12px',
              backgroundColor: wsConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: wsConnected ? '#22c55e' : '#ef4444',
              border: `1px solid ${wsConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              <div className={`status-dot ${wsConnected ? 'online' : 'offline'}`} style={{ position: 'relative', top: 0, right: 0, width: '8px', height: '8px' }}></div>
              {wsConnected ? 'Live Updates Active' : 'Connecting to Live Server...'}
            </div>
          </div>
          <p>Real-time sensor readings across all sites</p>
        </div>
        {companyName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Building2 size={16} style={{ color: 'var(--accent-blue)' }} />
            {companyName}
          </div>
        )}
      </div>

      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon blue"><Thermometer size={22} /></div>
            <div className="stat-info">
              <div className="stat-value">{totalNodes}</div>
              <div className="stat-label">Total Nodes</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Activity size={22} /></div>
            <div className="stat-info">
              <div className="stat-value">{onlineNodes}</div>
              <div className="stat-label">Online</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Droplets size={22} /></div>
            <div className="stat-info">
              <div className="stat-value">{totalNodes - onlineNodes}</div>
              <div className="stat-label">Offline</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><AlertTriangle size={22} /></div>
            <div className="stat-info">
              <div className="stat-value">{alertNodes}</div>
              <div className="stat-label">Alerts</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center mt-24" style={{ color: 'var(--text-muted)' }}>
            Loading sensors...
          </div>
        ) : nodes.length === 0 ? (
          <GettingStarted />
        ) : (
          Object.entries(grouped).map(([siteName, rooms]) => (
            <div key={siteName} className="site-section">
              <div className="site-section-header">
                <h3>📍 {siteName}</h3>
              </div>
              {Object.entries(rooms).map(([roomName, roomNodes]) => (
                <div key={roomName} style={{ marginBottom: '20px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span className="room-label">{roomName}</span>
                  </div>
                  <div className="sensor-grid">
                    {roomNodes.map((node) => (
                      <SensorCard key={node.node_id} node={node} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {updateAvailable && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          background: 'var(--bg-card)',
          border: '1px solid var(--accent-blue)',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          padding: '16px',
          maxWidth: '320px',
          display: 'flex',
          gap: '12px',
          alignItems: 'start',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--accent-blue)',
            borderRadius: '50%',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <RefreshCw size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              Server Update Available
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              A new version of TempSense is ready. Update now to access the latest features.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/settings?tab=updates')}
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                Go to Settings
              </button>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setUpdateAvailable(false)}
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
