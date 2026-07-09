const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const os = require('os');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
require('dotenv').config();

function getServerIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const face = interfaces[devName];
    for (let i = 0; i < face.length; i++) {
      const alias = face[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

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
    if (!email || !name) {
      return res.status(400).json({ error: 'email and name are required' });
    }

    const validRoles = ['admin', 'site_manager', 'customer'];
    const assignRole = validRoles.includes(role) ? role : 'customer';

    // If password not provided, generate a secure random password hash
    const finalPassword = password || crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(finalPassword, 10);
    const result = await pool.query(
      'INSERT INTO users (account_id, email, password, name, role, site_ids, room_ids) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, name, role, site_ids, room_ids',
      [accountId || req.user.accountId, email.toLowerCase(), hashed, name, assignRole, siteIds || [], roomIds || []]
    );

    const user = result.rows[0];

    // If registered without password, create invite token and send email invite
    if (!password) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await pool.query(
        'INSERT INTO user_invitations (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt]
      );

      let frontendHost = process.env.FRONTEND_URL;
      if (!frontendHost) {
        const reqHost = req.headers.host || '';
        let hostname = reqHost.split(':')[0];
        if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
          hostname = getServerIP();
        }
        frontendHost = `http://${hostname}:81`;
      }
      const inviteUrl = `${frontendHost}/accept-invite?token=${token}`;

      let emailSent = false;
      try {
        await sendEmail({
          to: user.email,
          subject: 'Welcome to TEMPSENSE — Complete Your Registration',
          text: `Hello ${user.name},\n\nYou have been invited to join TEMPSENSE as a ${user.role}. Please click this link to set your password and access your account:\n\n${inviteUrl}\n\nThis link will expire in 7 days.`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0e1a; color: #f1f5f9; padding: 40px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e2d4a; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #3b82f6; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">TEMPSENSE</h1>
                <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Cold Chain Monitoring Platform</p>
              </div>
              <div style="background-color: #111827; padding: 32px; border-radius: 8px; border: 1px solid #1e2d4a;">
                <h2 style="color: #f1f5f9; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Account Invitation</h2>
                <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                  Hello ${user.name},<br/><br/>
                  You have been invited to join the TEMPSENSE platform with the role of <strong>${user.role}</strong>. Please click the button below to set your password and complete your registration.
                </p>
                <div style="text-align: center; margin-bottom: 24px;">
                  <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 15px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3); transition: opacity 0.2s;">
                    Accept Invitation & Set Password
                  </a>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
                  Or copy and paste this link in your browser:<br/>
                  <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
                </p>
              </div>
              <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 11px;">
                This link will expire in 7 days. If you did not expect this invitation, please ignore this email.
              </div>
            </div>
          `
        });
        emailSent = true;
      } catch (err) {
        console.error('[INVITE] Failed to send invitation email:', err.message);
      }

      return res.status(201).json({ user, inviteToken: token, emailSent });
    }

    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('[AUTH] Register/Invite error:', err);
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

// GET /api/auth/company/public (public access)
router.get('/company/public', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM accounts ORDER BY id ASC LIMIT 1');
    res.json({ companyName: result.rows.length > 0 ? result.rows[0].name : 'TEMPSENSE' });
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

// GET /api/auth/invite/validate (public)
router.get('/invite/validate', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const result = await pool.query(
      `SELECT u.email, u.name, u.role
       FROM user_invitations ui
       JOIN users u ON ui.user_id = u.id
       WHERE ui.token = $1 AND ui.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation link' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[AUTH] Validate invite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/invite/accept (public)
router.post('/invite/accept', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify token
    const inviteResult = await pool.query(
      `SELECT ui.user_id, u.email, u.name, u.role, u.account_id, u.site_ids, u.room_ids
       FROM user_invitations ui
       JOIN users u ON ui.user_id = u.id
       WHERE ui.token = $1 AND ui.expires_at > NOW()`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation link' });
    }

    const invitedUser = inviteResult.rows[0];

    // Update password
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password = $1, profile_completed = TRUE WHERE id = $2',
      [hashed, invitedUser.user_id]
    );

    // Delete token
    await pool.query('DELETE FROM user_invitations WHERE token = $1', [token]);

    // Fetch company name
    let companyName = '';
    try {
      const acct = await pool.query('SELECT name FROM accounts WHERE id = $1', [invitedUser.account_id]);
      if (acct.rows.length > 0) companyName = acct.rows[0].name;
    } catch (e) { /* ignore */ }

    // Generate JWT
    const tokenPayload = {
      userId: invitedUser.user_id,
      accountId: invitedUser.account_id,
      email: invitedUser.email,
      name: invitedUser.name,
      role: invitedUser.role,
      siteIds: invitedUser.site_ids,
      roomIds: invitedUser.room_ids,
      profileCompleted: true,
    };
    const jwtToken = jwt.sign(tokenPayload, SECRET, { expiresIn: '24h' });

    res.json({
      token: jwtToken,
      user: {
        id: invitedUser.user_id,
        name: invitedUser.name,
        email: invitedUser.email,
        role: invitedUser.role,
        siteIds: invitedUser.site_ids,
        roomIds: invitedUser.room_ids,
        profileCompleted: true,
        companyName,
      },
    });
  } catch (err) {
    console.error('[AUTH] Accept invite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
