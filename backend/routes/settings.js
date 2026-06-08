const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// GET /api/settings/smtp
router.get('/smtp', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT use_custom, host, port, user_email, secure, sender_name FROM smtp_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({ use_custom: false, sender_name: 'Tempsense Alerts' });
    }
    const r = result.rows[0];
    res.json({
      use_custom: r.use_custom === true,
      host: r.use_custom ? (r.host || '') : '',
      port: r.use_custom ? (r.port || 587) : 587,
      user_email: r.use_custom ? (r.user_email || '') : '',
      secure: r.use_custom ? (r.secure === true) : false,
      sender_name: r.sender_name || 'Tempsense Alerts'
    });
  } catch (err) {
    console.error('[SETTINGS] GET SMTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/settings/smtp/test
router.get('/smtp/test', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
    const s = result.rows[0];
    
    let transporterConfig;
    if (s && s.use_custom) {
      transporterConfig = {
        host: s.host,
        port: s.port,
        secure: s.secure,
        auth: {
          user: s.user_email,
          pass: s.password,
        },
      };
    } else {
      transporterConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'tempsense.maxworth@gmail.com',
          pass: process.env.DECRYPTED_SMTP_PASS,
        },
      };
    }

    const transporter = nodemailer.createTransport(transporterConfig);
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (err) {
    res.status(500).json({ error: 'SMTP test failed', details: err.message });
  }
});

router.post('/smtp', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { use_custom, host, port, user_email, password, secure, sender_name } = req.body;
    const isCustom = use_custom === true || use_custom === 'true' || (use_custom === undefined && host !== undefined);
    let finalPassword = password;
    
    // Check if exists
    const check = await pool.query('SELECT id, password as existing_password FROM smtp_settings LIMIT 1');
    if (check.rows.length > 0) {
      if (isCustom) {
        if (!host || !port || !user_email) {
          return res.status(400).json({ error: 'Host, port, and email address are required when custom SMTP is enabled' });
        }
        finalPassword = password || check.rows[0].existing_password;
        if (!finalPassword) {
          return res.status(400).json({ error: 'Password is required' });
        }
      }
      await pool.query(
        `UPDATE smtp_settings SET 
          use_custom = $1, host = $2, port = $3, user_email = $4, password = $5, secure = $6, sender_name = $7, updated_at = NOW()
         WHERE id = $8`,
        [isCustom, isCustom ? host : null, isCustom ? parseInt(port) : null, isCustom ? user_email : null, isCustom ? finalPassword : null, isCustom ? (secure === true || secure === 'true') : false, sender_name, check.rows[0].id]
      );
    } else {
      if (isCustom) {
        if (!host || !port || !user_email || !password) {
          return res.status(400).json({ error: 'Host, port, email address, and password are required when custom SMTP is enabled' });
        }
      }
      await pool.query(
        `INSERT INTO smtp_settings (use_custom, host, port, user_email, password, secure, sender_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [isCustom, isCustom ? host : null, isCustom ? parseInt(port) : null, isCustom ? user_email : null, isCustom ? password : null, isCustom ? (secure === true || secure === 'true') : false, sender_name]
      );
    }

    // Write backup to local JSON file
    const fs = require('fs');
    const path = require('path');
    const backupPath = path.join(__dirname, '../smtp_settings.json');
    try {
      fs.writeFileSync(backupPath, JSON.stringify({
        use_custom: isCustom,
        host: isCustom ? host : null,
        port: isCustom ? parseInt(port) : null,
        user_email: isCustom ? user_email : null,
        password: isCustom ? finalPassword : null,
        secure: isCustom ? (secure === true || secure === 'true') : false,
        sender_name
      }, null, 2), 'utf8');
      console.log('[SETTINGS] SMTP backup saved to local json file');
    } catch (fsErr) {
      console.error('[SETTINGS] Failed to save local SMTP backup:', fsErr.message);
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

// POST /api/settings/reports/:id/test - Trigger immediate test run of scheduled report
router.post('/reports/:id/test', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { runReport } = require('../services/reportScheduler');
    
    // Fetch schedule details
    const result = await pool.query(`
      SELECT sr.*, s.name as site_name 
      FROM scheduled_reports sr
      JOIN sites s ON sr.site_id = s.id
      WHERE sr.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }
    
    const s = result.rows[0];
    // Run report immediately (creates attachments, sends email via SMTP)
    await runReport(s);
    
    res.json({ success: true, message: `Test report "${s.name}" sent successfully` });
  } catch (err) {
    console.error('[SETTINGS] Test schedule error:', err);
    res.status(500).json({ error: 'Failed to send test report', details: err.message });
  }
});

const { checkForUpdates, installUpdate, startAutoUpdateScheduler } = require('../services/autoUpdater');
const { runDiagnostics } = require('../services/diagnostics');

// GET /api/settings/update - Fetch update settings and git status
router.get('/update', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const configRes = await pool.query('SELECT auto_update_enabled, auto_update_interval, last_update_check FROM system_settings LIMIT 1');
    const config = configRes.rows[0] || { auto_update_enabled: true, auto_update_interval: 24, last_update_check: null };
    
    const gitStatus = await checkForUpdates();
    
    res.json({
      config: {
        autoUpdateEnabled: config.auto_update_enabled === true,
        autoUpdateInterval: config.auto_update_interval || 24,
        lastUpdateCheck: config.last_update_check
      },
      git: gitStatus
    });
  } catch (err) {
    console.error('[SETTINGS] GET Update error:', err);
    res.status(500).json({ error: 'Failed to retrieve update configuration' });
  }
});

// POST /api/settings/update/check - Trigger manual update check
router.post('/update/check', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const gitStatus = await checkForUpdates();
    res.json(gitStatus);
  } catch (err) {
    console.error('[SETTINGS] POST Check Update error:', err);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// POST /api/settings/update/install - Trigger update installation and server reboot
router.post('/update/install', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await installUpdate();
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[SETTINGS] POST Install Update error:', err);
    res.status(500).json({ error: 'Failed to install updates', details: err.message });
  }
});

// POST /api/settings/update/config - Save automatic check config
router.post('/update/config', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { auto_update_enabled, auto_update_interval } = req.body;
    
    if (auto_update_interval && (isNaN(auto_update_interval) || auto_update_interval <= 0)) {
      return res.status(400).json({ error: 'Update interval must be a positive number of hours' });
    }

    await pool.query(
      `UPDATE system_settings SET 
        auto_update_enabled = $1, 
        auto_update_interval = $2,
        updated_at = NOW()
       WHERE id = 1`,
      [auto_update_enabled === true, auto_update_interval || 24]
    );

    // Restart/apply scheduler configuration
    await startAutoUpdateScheduler();

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (err) {
    console.error('[SETTINGS] POST Update Config error:', err);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// GET /api/settings/diagnose - Run self-diagnostics
router.get('/diagnose', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const diagnostics = await runDiagnostics();
    res.json(diagnostics);
  } catch (err) {
    console.error('[SETTINGS] GET Diagnose error:', err);
    res.status(500).json({ error: 'Diagnostics suite execution failed', details: err.message });
  }
});

module.exports = router;

