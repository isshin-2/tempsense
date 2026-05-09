import { useState, useEffect } from 'react';
import { fetchAlerts } from '../services/api';
import { Bell, AlertTriangle } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    try {
      setAlerts(await fetchAlerts({ limit: 100 }));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Alert History</h2>
        <p>Threshold breach notifications — one email per hour per node</p>
      </div>

      <div className="page-body">
        {alerts.length === 0 ? (
          <div className="text-center mt-24" style={{ color: 'var(--text-muted)' }}>
            <Bell size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No alerts triggered yet. System is running clean.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Time</th>
                <th>Node</th>
                <th>Device ID</th>
                <th>Type</th>
                <th>Details</th>
                <th>Sent To</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td><AlertTriangle size={14} style={{ color: 'var(--accent-red)' }} /></td>
                  <td style={{ fontSize: '12px' }}>
                    {new Date(a.sent_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.node_name}</td>
                  <td>{a.device_id}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                      background: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red)'
                    }}>
                      {a.alert_type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', maxWidth: '300px', whiteSpace: 'pre-line' }}>{a.message}</td>
                  <td style={{ fontSize: '12px' }}>{a.sent_to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
