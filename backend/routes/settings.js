const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// GET /api/settings/smtp
router.get('/smtp', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT host, port, user_email, secure, sender_name FROM smtp_settings LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('[SETTINGS] GET SMTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/smtp
router.get('/smtp/test', authMiddleware, requireRole('admin'), async (req, res) => {
  // Simple test endpoint
  try {
    const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
    if (result.rows.length === 0) return res.status(404).json({ error: 'SMTP settings not configured' });
    
    const s = result.rows[0];
    const transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: {
        user: s.user_email,
        pass: s.password,
      },
    });

    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (err) {
    res.status(500).json({ error: 'SMTP test failed', details: err.message });
  }
});

router.post('/smtp', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { host, port, user_email, password, secure, sender_name } = req.body;
    
    // Check if exists
    const check = await pool.query('SELECT id FROM smtp_settings LIMIT 1');
    if (check.rows.length > 0) {
      await pool.query(
        `UPDATE smtp_settings SET 
          host = $1, port = $2, user_email = $3, password = $4, secure = $5, sender_name = $6, updated_at = NOW()
         WHERE id = $7`,
        [host, port, user_email, password, secure, sender_name, check.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO smtp_settings (host, port, user_email, password, secure, sender_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [host, port, user_email, password, secure, sender_name]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[SETTINGS] POST SMTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Scheduled Reports
router.get('/reports', authMiddleware, requireRole('admin', 'site_manager'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sr.*, s.name as site_name 
      FROM scheduled_reports sr
      JOIN sites s ON sr.site_id = s.id
      ORDER BY sr.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[SETTINGS] GET Reports error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reports', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name, frequency, recipients, siteId, reportType, isActive } = req.body;
    const result = await pool.query(
      `INSERT INTO scheduled_reports (name, frequency, recipients, site_id, report_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, frequency, recipients, siteId, reportType, isActive ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[SETTINGS] POST Reports error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/reports/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name, frequency, recipients, siteId, reportType, isActive } = req.body;
    const result = await pool.query(
      `UPDATE scheduled_reports SET 
        name = COALESCE($1, name),
        frequency = COALESCE($2, frequency),
        recipients = COALESCE($3, recipients),
        site_id = COALESCE($4, site_id),
        report_type = COALESCE($5, report_type),
        is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [name, frequency, recipients, siteId, reportType, isActive, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[SETTINGS] PUT Reports error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/reports/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM scheduled_reports WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[SETTINGS] DELETE Reports error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
