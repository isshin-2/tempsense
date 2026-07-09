const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { generateReport } = require('../services/pdfGenerator');
const { stringify } = require('csv-stringify/sync');

const router = express.Router();

// GET /api/data/latest - Latest reading per node
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (n.id)
        n.id as node_id, n.device_id, n.name as node_name,
        n.temp_high, n.temp_low, n.humidity_high, n.humidity_low,
        n.last_seen, n.is_active, n.reboot_required as reboot_required,
        r.id as room_id, r.name as room_name,
        s.id as site_id, s.name as site_name,
        sd.t1, sd.t2, sd.td, sd.humidity, sd.recorded_at
      FROM nodes n
      JOIN rooms r ON n.room_id = r.id
      JOIN sites s ON r.site_id = s.id
      LEFT JOIN sensor_data sd ON sd.node_id = n.id
      WHERE n.is_active = TRUE
      ORDER BY n.id, sd.recorded_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[DATA] Latest error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/data/history?nodeId=&startDate=&endDate=
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { nodeId, siteId, roomId, startDate, endDate, limit } = req.query;

    let query = `
      SELECT sd.*, n.name as node_name, n.device_id, r.name as room_name, s.name as site_name
      FROM sensor_data sd
      JOIN nodes n ON sd.node_id = n.id
      JOIN rooms r ON n.room_id = r.id
      JOIN sites s ON r.site_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      query += ` AND sd.node_id = $${params.length}`;
    }
    if (siteId) {
      params.push(siteId);
      query += ` AND s.id = $${params.length}`;
    }
    if (roomId) {
      params.push(roomId);
      query += ` AND r.id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND sd.recorded_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND sd.recorded_at <= $${params.length}`;
    }

    query += ' ORDER BY sd.recorded_at DESC';

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    } else {
      query += ' LIMIT 1000';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[DATA] History error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/data/export/csv?siteId=&startDate=&endDate=
router.get('/export/csv', authMiddleware, requireRole('admin', 'site_manager'), async (req, res) => {
  try {
    const { siteId, roomId, nodeId, startDate, endDate, excludeAlerts } = req.query;
    if (!siteId || !startDate || !endDate) {
      return res.status(400).json({ error: 'siteId, startDate, and endDate are required' });
    }

    let query = `
      SELECT sd.recorded_at, n.name as node_name, n.device_id, r.name as room_name,
             sd.t1, sd.t2, sd.td, sd.humidity, n.temp_high, n.temp_low, n.humidity_high, n.humidity_low,
             n.t1_name, n.t2_name, n.td_name, n.humidity_name
      FROM sensor_data sd
      JOIN nodes n ON sd.node_id = n.id
      JOIN rooms r ON n.room_id = r.id
      WHERE r.site_id = $1 AND sd.recorded_at >= $2 AND sd.recorded_at <= $3
    `;
    const params = [siteId, startDate, endDate];

    if (roomId) {
      params.push(roomId);
      query += ` AND n.room_id = $${params.length}`;
    }
    if (nodeId) {
      params.push(nodeId);
      query += ` AND sd.node_id = $${params.length}`;
    }

    query += ' ORDER BY sd.recorded_at ASC';

    const result = await pool.query(query, params);
    const firstRow = result.rows[0];

    const csvColumns = [
      { key: 'Timestamp', header: 'Timestamp' },
      { key: 'Node', header: 'Node' },
      { key: 'DeviceID', header: 'DeviceID' },
      { key: 'Room', header: 'Room' },
      { key: 'T1', header: nodeId && firstRow ? `${firstRow.t1_name || 'T1'} (°C)` : 'T1 (°C)' },
      { key: 'T2', header: nodeId && firstRow ? `${firstRow.t2_name || 'T2'} (°C)` : 'T2 (°C)' },
      { key: 'DHT', header: nodeId && firstRow ? `${firstRow.td_name || 'DHT Temp'} (°C)` : 'DHT Temp (°C)' },
      { key: 'Humidity', header: nodeId && firstRow ? `${firstRow.humidity_name || 'Humidity'} (%)` : 'Humidity (%)' },
      { key: 'Status', header: 'Alerts/Status' },
    ];

    const csvData = [];
    for (const r of result.rows) {
      const alerts = [];
      if (r.t1 > r.temp_high) alerts.push('T1 High');
      if (r.t1 < r.temp_low) alerts.push('T1 Low');
      if (r.t2 > r.temp_high) alerts.push('T2 High');
      if (r.t2 < r.temp_low) alerts.push('T2 Low');
      if (r.td > r.temp_high) alerts.push('DHT High');
      if (r.td < r.temp_low) alerts.push('DHT Low');
      if (r.humidity > r.humidity_high) alerts.push('Hum High');
      if (r.humidity < r.humidity_low) alerts.push('Hum Low');

      if (excludeAlerts === 'true' && alerts.length > 0) {
        continue;
      }

      csvData.push({
        Timestamp: new Date(r.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        Node: r.node_name,
        DeviceID: r.device_id,
        Room: r.room_name,
        T1: r.t1 !== null ? r.t1.toFixed(2) : '',
        T2: r.t2 !== null ? r.t2.toFixed(2) : '',
        DHT: r.td !== null ? r.td.toFixed(2) : '',
        Humidity: r.humidity !== null ? r.humidity.toFixed(2) : '',
        Status: alerts.length > 0 ? alerts.join(', ') : 'Normal'
      });
    }

    const filename = `tempsense_report_${new Date().toISOString().split('T')[0]}.csv`;
    const csv = stringify(csvData, { header: true, columns: csvColumns });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  } catch (err) {
    console.error('[DATA] CSV export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/data/export/pdf?siteId=&startDate=&endDate=
router.get('/export/pdf', authMiddleware, requireRole('admin', 'site_manager'), async (req, res) => {
  try {
    const { siteId, roomId, nodeId, startDate, endDate, excludeAlerts } = req.query;
    if (!siteId || !startDate || !endDate) {
      return res.status(400).json({ error: 'siteId, startDate, and endDate are required' });
    }
    await generateReport({ siteId, roomId, nodeId, startDate, endDate, excludeAlerts: excludeAlerts === 'true' }, res);
  } catch (err) {
    console.error('[DATA] PDF export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/data/alerts?nodeId=&limit=
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const { nodeId, limit } = req.query;
    let query = `
      SELECT a.*, n.name as node_name, n.device_id
      FROM alerts a
      JOIN nodes n ON a.node_id = n.id
    `;
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      query += ` WHERE a.node_id = $${params.length}`;
    }

    query += ' ORDER BY a.sent_at DESC';
    params.push(parseInt(limit) || 50);
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[DATA] Alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
