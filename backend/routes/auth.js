const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'tempsense_dev_secret';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        accountId: user.account_id,
        email: user.email,
        name: user.name,
        role: user.role,
        siteIds: user.site_ids,
      },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        siteIds: user.site_ids,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/register (super_admin only)
router.post('/register', authMiddleware, requireRole('super_admin'), async (req, res) => {
  try {
    const { email, password, name, role, accountId, siteIds } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (account_id, email, password, name, role, site_ids) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role',
      [accountId || req.user.accountId, email.toLowerCase(), hashed, name, role || 'viewer', siteIds || []]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/users (admin only)
router.get('/users', authMiddleware, requireRole('super_admin', 'site_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, account_id, email, name, role, site_ids, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[AUTH] List users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
