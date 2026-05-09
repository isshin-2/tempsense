const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/sites
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = 'SELECT s.*, a.name as account_name FROM sites s JOIN accounts a ON s.account_id = a.id';
    const params = [];

    // If site_admin or viewer, restrict to assigned sites
    if (req.user.role === 'site_admin' || req.user.role === 'viewer') {
      if (req.user.siteIds && req.user.siteIds.length > 0) {
        query += ' WHERE s.id = ANY($1)';
        params.push(req.user.siteIds);
      } else {
        return res.json([]);
      }
    }

    query += ' ORDER BY s.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[SITES] List error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sites
router.post('/', authMiddleware, requireRole('super_admin', 'site_admin'), async (req, res) => {
  try {
    const { name, location, accountId } = req.body;
    if (!name) return res.status(400).json({ error: 'Site name is required' });

    const result = await pool.query(
      'INSERT INTO sites (account_id, name, location) VALUES ($1, $2, $3) RETURNING *',
      [accountId || req.user.accountId, name, location || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[SITES] Create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/sites/:id
router.put('/:id', authMiddleware, requireRole('super_admin', 'site_admin'), async (req, res) => {
  try {
    const { name, location } = req.body;
    const result = await pool.query(
      'UPDATE sites SET name = COALESCE($1, name), location = COALESCE($2, location) WHERE id = $3 RETURNING *',
      [name, location, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Site not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[SITES] Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sites/:id
router.delete('/:id', authMiddleware, requireRole('super_admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM sites WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[SITES] Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
