export default function SensorCard({ node }) {
  const {
    node_name, room_name, site_name, device_id,
    t1, t2, td, humidity,
    temp_high, temp_low, humidity_high, humidity_low,
    last_seen, recorded_at, reboot_required,
    t1_name, t2_name, td_name, humidity_name
  } = node;

  function tempClass(val) {
    if (val === null || val === undefined) return 'na';
    if (val < temp_low) return 'cold';
    if (val > temp_high) return 'hot';
    if (val > temp_high - 3) return 'warm';
    return 'ok';
  }

  function humidClass(val) {
    if (val === null || val === undefined) return 'na';
    if (val < humidity_low || val > humidity_high) return 'hot';
    return 'humid';
  }

  const isBreached =
    (t1 !== null && (t1 > temp_high || t1 < temp_low)) ||
    (t2 !== null && (t2 > temp_high || t2 < temp_low)) ||
    (td !== null && (td > temp_high || td < temp_low)) ||
    (humidity !== null && (humidity > humidity_high || humidity < humidity_low));

  // Determine online status
  const lastSeenDate = last_seen ? new Date(last_seen) : null;
  const staleMinutes = lastSeenDate ? (Date.now() - lastSeenDate.getTime()) / 60000 : Infinity;
  const statusClass = staleMinutes < 2 ? 'online' : staleMinutes < 10 ? 'stale' : 'offline';

  function format(v) {
    return v !== null && v !== undefined ? v.toFixed(1) : '--';
  }

  const timestamp = recorded_at
    ? new Date(recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';

  return (
    <div className={`sensor-card ${isBreached ? 'alarm' : ''}`}>
      <div className="sensor-card-header">
        <div className="info">
          <h3>{node_name}</h3>
          <span>{room_name} • {site_name}</span>
        </div>
        <span className={`status-dot ${statusClass}`} title={statusClass}></span>
      </div>

      {reboot_required && (
        <div className="reboot-required-banner" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          margin: '10px 0 2px 0'
        }}>
          <span>⚠️</span>
          <span>Reboot Required: Cycle device power (OFF/ON)</span>
        </div>
      )}

      <div className="sensor-readings">
        <div className="reading-box">
          <div className="label">{t1_name || 'DS18 #1'}</div>
          <div className={`value ${tempClass(t1)}`}>
            {format(t1)}<span className="unit">°C</span>
          </div>
        </div>
        <div className="reading-box">
          <div className="label">{t2_name || 'DS18 #2'}</div>
          <div className={`value ${tempClass(t2)}`}>
            {format(t2)}<span className="unit">°C</span>
          </div>
        </div>
        <div className="reading-box">
          <div className="label">{td_name || 'DHT Temp'}</div>
          <div className={`value ${tempClass(td)}`}>
            {format(td)}<span className="unit">°C</span>
          </div>
        </div>
        <div className="reading-box">
          <div className="label">{humidity_name || 'Humidity'}</div>
          <div className={`value ${humidClass(humidity)}`}>
            {format(humidity)}<span className="unit">%</span>
          </div>
        </div>
      </div>

      <div className="sensor-card-footer">
        <span>Device #{device_id}</span>
        <span>{timestamp}</span>
      </div>
    </div>
  );
}
