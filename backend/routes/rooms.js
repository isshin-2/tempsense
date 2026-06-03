const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms?siteId=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { siteId } = req.query;
    let query = 'SELECT r.*, s.name as site_name FROM rooms r JOIN sites s ON r.site_id = s.id';
    const params = [];
    const conditions = [];

    if (siteId) {
      conditions.push(`r.site_id = $${params.length + 1}`);
      params.push(siteId);
    }

    // Site manager: restrict to assigned sites
    if (req.user.role === 'site_manager') {
      if (req.user.siteIds && req.user.siteIds.length > 0) {
        conditions.push(`r.site_id = ANY($${params.length + 1})`);
        params.push(req.user.siteIds);
      } else {
        return res.json([]);
      }
    }

    // Customer: restrict to assigned rooms
    if (req.user.role === 'customer') {
      if (req.user.roomIds && req.user.roomIds.length > 0) {
        conditions.push(`r.id = ANY($${params.length + 1})`);
        params.push(req.user.roomIds);
      } else {
        return res.json([]);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.name, r.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[ROOMS] List error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { siteId, name } = req.body;
    if (!siteId || !name) return res.status(400).json({ error: 'siteId and name are required' });

    const result = await pool.query(
      'INSERT INTO rooms (site_id, name) VALUES ($1, $2) RETURNING *',
      [siteId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[ROOMS] Create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/rooms/:id
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE rooms SET name = COALESCE($1, name) WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ROOMS] Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[ROOMS] Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
