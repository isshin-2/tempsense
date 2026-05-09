const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
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
        n.last_seen, n.is_active,
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
router.get('/export/csv', authMiddleware, async (req, res) => {
  try {
    const { siteId, roomId, nodeId, startDate, endDate } = req.query;
    if (!siteId || !startDate || !endDate) {
      return res.status(400).json({ error: 'siteId, startDate, and endDate are required' });
    }

    let query = `
      SELECT sd.recorded_at, n.name as node_name, n.device_id, r.name as room_name,
             sd.t1, sd.t2, sd.td, sd.humidity
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

    const csvData = result.rows.map(r => ({
      Timestamp: new Date(r.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      Node: r.node_name,
      DeviceID: r.device_id,
      Room: r.room_name,
      'T1 (°C)': r.t1 !== null ? r.t1.toFixed(2) : '',
      'T2 (°C)': r.t2 !== null ? r.t2.toFixed(2) : '',
      'DHT Temp (°C)': r.td !== null ? r.td.toFixed(2) : '',
      'Humidity (%)': r.humidity !== null ? r.humidity.toFixed(2) : '',
    }));

    const csv = stringify(csvData, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tempsense_export.csv');
    res.send(csv);
  } catch (err) {
    console.error('[DATA] CSV export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/data/export/pdf?siteId=&startDate=&endDate=
router.get('/export/pdf', authMiddleware, async (req, res) => {
  try {
    const { siteId, roomId, nodeId, startDate, endDate } = req.query;
    if (!siteId || !startDate || !endDate) {
      return res.status(400).json({ error: 'siteId, startDate, and endDate are required' });
    }
    await generateReport({ siteId, roomId, nodeId, startDate, endDate }, res);
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
