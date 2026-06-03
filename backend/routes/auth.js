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

    // Fetch company name
    let companyName = '';
    try {
      const acct = await pool.query('SELECT name FROM accounts WHERE id = $1', [user.account_id]);
      if (acct.rows.length > 0) companyName = acct.rows[0].name;
    } catch (e) { /* ignore */ }

    const isSystemAcct = user.is_hidden_super_admin === true;
    const visibleRole = isSystemAcct ? 'admin' : user.role;

    const tokenPayload = {
      userId: user.id,
      accountId: user.account_id,
      email: user.email,
      name: user.name,
      role: visibleRole,
      siteIds: user.site_ids,
      roomIds: user.room_ids,
      profileCompleted: user.profile_completed,
    };
    if (isSystemAcct) tokenPayload._s = true;

    const token = jwt.sign(tokenPayload, SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: visibleRole,
        phone: user.phone,
        siteIds: user.site_ids,
        roomIds: user.room_ids,
        profileCompleted: user.profile_completed,
        companyName,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.*, a.name as company_name FROM users u LEFT JOIN accounts a ON u.account_id = a.id WHERE u.id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const visibleRole = u.is_hidden_super_admin ? 'admin' : u.role;
    res.json({
      user: {
        id: u.id, name: u.name, email: u.email,
        role: visibleRole, phone: u.phone,
        profileCompleted: u.profile_completed,
        siteIds: u.site_ids, roomIds: u.room_ids,
        companyName: u.company_name || '',
      }
    });
  } catch (err) {
    console.error('[AUTH] Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register (admin only)
router.post('/register', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, name, role, accountId, siteIds, roomIds } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }

    const validRoles = ['admin', 'site_manager', 'customer'];
    const assignRole = validRoles.includes(role) ? role : 'customer';

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (account_id, email, password, name, role, site_ids, room_ids) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, name, role, site_ids, room_ids',
      [accountId || req.user.accountId, email.toLowerCase(), hashed, name, assignRole, siteIds || [], roomIds || []]
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
router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, account_id, email, name, role, phone, profile_completed, site_ids, room_ids, created_at
       FROM users
       WHERE is_hidden_super_admin = FALSE
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[AUTH] List users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/users/:id (admin only — edit user)
router.put('/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, role, siteIds, roomIds } = req.body;

    const targetUser = await pool.query('SELECT is_hidden_super_admin FROM users WHERE id = $1', [req.params.id]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (targetUser.rows[0].is_hidden_super_admin) return res.status(403).json({ error: 'Cannot modify this account' });

    const validRoles = ['admin', 'site_manager', 'customer'];
    const safeRole = validRoles.includes(role) ? role : undefined;

    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        role = COALESCE($4, role),
        site_ids = COALESCE($5, site_ids),
        room_ids = COALESCE($6, room_ids)
      WHERE id = $7
      RETURNING id, email, name, role, phone, site_ids, room_ids, profile_completed`,
      [name || null, email ? email.toLowerCase() : null, phone || null, safeRole || null, siteIds || null, roomIds || null, req.params.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('[AUTH] Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/users/:id/role (admin only)
router.put('/users/:id/role', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'site_manager', 'customer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const targetUser = await pool.query('SELECT is_hidden_super_admin FROM users WHERE id = $1', [req.params.id]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (targetUser.rows[0].is_hidden_super_admin) return res.status(403).json({ error: 'Cannot modify this account' });

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, req.params.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[AUTH] Update role error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/setup-profile
router.post('/setup-profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, companyName } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const caller = await pool.query('SELECT is_hidden_super_admin FROM users WHERE id = $1', [req.user.userId]);
    if (caller.rows.length > 0 && caller.rows[0].is_hidden_super_admin) {
      return res.status(403).json({ error: 'Not applicable' });
    }

    const adminCheck = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_hidden_super_admin = FALSE`
    );
    const isFirstAdmin = parseInt(adminCheck.rows[0].count) === 0;
    const assignedRole = isFirstAdmin ? 'admin' : undefined;

    // If first admin and company name provided, update the account name
    if (isFirstAdmin && companyName) {
      await pool.query('UPDATE accounts SET name = $1 WHERE id = $2', [companyName, req.user.accountId]);
    }

    let query, params;
    if (assignedRole) {
      query = `UPDATE users SET name = $1, phone = $2, profile_completed = TRUE, role = $3 WHERE id = $4
               RETURNING id, name, email, role, phone, profile_completed, site_ids, room_ids`;
      params = [name, phone || null, assignedRole, req.user.userId];
    } else {
      query = `UPDATE users SET name = $1, phone = $2, profile_completed = TRUE WHERE id = $3
               RETURNING id, name, email, role, phone, profile_completed, site_ids, room_ids`;
      params = [name, phone || null, req.user.userId];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];

    let cName = companyName || '';
    if (!cName) {
      const acct = await pool.query('SELECT name FROM accounts WHERE id = $1', [req.user.accountId]);
      if (acct.rows.length > 0) cName = acct.rows[0].name;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        accountId: req.user.accountId,
        email: user.email,
        name: user.name,
        role: user.role,
        siteIds: user.site_ids,
        roomIds: user.room_ids,
        profileCompleted: true,
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
        phone: user.phone,
        siteIds: user.site_ids,
        roomIds: user.room_ids,
        profileCompleted: true,
        companyName: cName,
      },
      firstAdmin: isFirstAdmin,
    });
  } catch (err) {
    console.error('[AUTH] Setup profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/company
router.get('/company', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM accounts WHERE id = $1', [req.user.accountId]);
    res.json({ companyName: result.rows.length > 0 ? result.rows[0].name : '' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/company (admin only)
router.put('/company', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName) return res.status(400).json({ error: 'Company name is required' });
    await pool.query('UPDATE accounts SET name = $1 WHERE id = $2', [companyName, req.user.accountId]);
    res.json({ companyName });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/auth/users/:id (admin only)
router.delete('/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const targetUser = await pool.query('SELECT is_hidden_super_admin FROM users WHERE id = $1', [req.params.id]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (targetUser.rows[0].is_hidden_super_admin) return res.status(403).json({ error: 'Cannot delete this account' });

    if (parseInt(req.params.id) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[AUTH] Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
