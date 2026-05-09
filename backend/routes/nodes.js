const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/nodes?roomId=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, siteId } = req.query;
    let query = `
      SELECT n.*, r.name as room_name, s.name as site_name, s.id as site_id
      FROM nodes n
      JOIN rooms r ON n.room_id = r.id
      JOIN sites s ON r.site_id = s.id
    `;
    const params = [];
    const conditions = [];

    if (roomId) {
      conditions.push(`n.room_id = $${params.length + 1}`);
      params.push(roomId);
    }
    if (siteId) {
      conditions.push(`s.id = $${params.length + 1}`);
      params.push(siteId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.name, r.name, n.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[NODES] List error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/nodes
router.post('/', authMiddleware, requireRole('super_admin', 'site_admin'), async (req, res) => {
  try {
    const { roomId, deviceId, name, ipAddress, tcpPort, samplingInterval, tempHigh, tempLow, humidityHigh, humidityLow } = req.body;
    if (!roomId || deviceId === undefined || !name) {
      return res.status(400).json({ error: 'roomId, deviceId, and name are required' });
    }

    const result = await pool.query(
      `INSERT INTO nodes (room_id, device_id, name, ip_address, tcp_port, sampling_interval, temp_high, temp_low, humidity_high, humidity_low)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        roomId, deviceId, name,
        ipAddress || null,
        tcpPort || 8080,
        samplingInterval || 5,
        tempHigh ?? 30.0,
        tempLow ?? 2.0,
        humidityHigh ?? 80.0,
        humidityLow ?? 20.0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Device ID already exists' });
    }
    console.error('[NODES] Create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/nodes/:id
router.put('/:id', authMiddleware, requireRole('super_admin', 'site_admin'), async (req, res) => {
  try {
    const { name, ipAddress, tcpPort, samplingInterval, tempHigh, tempLow, humidityHigh, humidityLow, isActive } = req.body;
    const result = await pool.query(
      `UPDATE nodes SET
        name = COALESCE($1, name),
        ip_address = COALESCE($2, ip_address),
        tcp_port = COALESCE($3, tcp_port),
        sampling_interval = COALESCE($4, sampling_interval),
        temp_high = COALESCE($5, temp_high),
        temp_low = COALESCE($6, temp_low),
        humidity_high = COALESCE($7, humidity_high),
        humidity_low = COALESCE($8, humidity_low),
        is_active = COALESCE($9, is_active)
       WHERE id = $10 RETURNING *`,
      [name, ipAddress, tcpPort, samplingInterval, tempHigh, tempLow, humidityHigh, humidityLow, isActive, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Node not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[NODES] Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/nodes/:id
router.delete('/:id', authMiddleware, requireRole('super_admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM nodes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[NODES] Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
