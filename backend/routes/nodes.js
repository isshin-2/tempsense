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

    // Site manager: restrict to assigned sites
    if (req.user.role === 'site_manager') {
      if (req.user.siteIds && req.user.siteIds.length > 0) {
        conditions.push(`s.id = ANY($${params.length + 1})`);
        params.push(req.user.siteIds);
      } else {
        return res.json([]);
      }
    }

    // Customer: restrict to assigned rooms
    if (req.user.role === 'customer') {
      if (req.user.roomIds && req.user.roomIds.length > 0) {
        conditions.push(`n.room_id = ANY($${params.length + 1})`);
        params.push(req.user.roomIds);
      } else {
        return res.json([]);
      }
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
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { roomId, deviceId, name, location, ipAddress, tcpPort, samplingInterval, tempHigh, tempLow, humidityHigh, humidityLow, notes, t1Name, t2Name, tdName, humidityName } = req.body;
    if (!roomId || deviceId === undefined || !name) {
      return res.status(400).json({ error: 'roomId, deviceId, and name are required' });
    }

    const result = await pool.query(
      `INSERT INTO nodes (room_id, device_id, name, location, ip_address, tcp_port, sampling_interval, temp_high, temp_low, humidity_high, humidity_low, notes, t1_name, t2_name, td_name, humidity_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        roomId, deviceId, name, location || null,
        ipAddress || null,
        tcpPort || 8080,
        samplingInterval || 5,
        tempHigh ?? 30.0,
        tempLow ?? 2.0,
        humidityHigh ?? 80.0,
        humidityLow ?? 20.0,
        notes || null,
        t1Name || 'DS18 #1',
        t2Name || 'DS18 #2',
        tdName || 'DHT Temp',
        humidityName || 'Humidity'
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
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name, deviceId, roomId, location, ipAddress, tcpPort, samplingInterval, tempHigh, tempLow, humidityHigh, humidityLow, isActive, notes, t1Name, t2Name, tdName, humidityName } = req.body;
    
    const result = await pool.query(
      `UPDATE nodes SET
        name = COALESCE($1, name),
        device_id = COALESCE($2, device_id),
        room_id = COALESCE($3, room_id),
        location = COALESCE($4, location),
        ip_address = COALESCE($5, ip_address),
        tcp_port = COALESCE($6, tcp_port),
        sampling_interval = COALESCE($7, sampling_interval),
        temp_high = COALESCE($8, temp_high),
        temp_low = COALESCE($9, temp_low),
        humidity_high = COALESCE($10, humidity_high),
        humidity_low = COALESCE($11, humidity_low),
        is_active = COALESCE($12, is_active),
        notes = COALESCE($13, notes),
        t1_name = COALESCE($14, t1_name),
        t2_name = COALESCE($15, t2_name),
        td_name = COALESCE($16, td_name),
        humidity_name = COALESCE($17, humidity_name)
       WHERE id = $18 RETURNING *`,
      [name, deviceId, roomId, location, ipAddress, tcpPort, samplingInterval, tempHigh, tempLow, humidityHigh, humidityLow, isActive, notes, t1Name, t2Name, tdName, humidityName, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Node not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Device ID already exists' });
    }
    console.error('[NODES] Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/nodes/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM nodes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[NODES] Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
