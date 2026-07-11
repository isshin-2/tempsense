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
    const { name, frequency, recipients, siteId, reportType, isActive, excludeAlerts, excludeOnboard } = req.body;
    const result = await pool.query(
      `INSERT INTO scheduled_reports (name, frequency, recipients, site_id, report_type, is_active, exclude_alerts, exclude_onboard)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, frequency, recipients, siteId, reportType, isActive ?? true, excludeAlerts ?? false, excludeOnboard ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[SETTINGS] POST Reports error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/reports/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name, frequency, recipients, siteId, reportType, isActive, excludeAlerts, excludeOnboard } = req.body;
    const result = await pool.query(
      `UPDATE scheduled_reports SET 
        name = COALESCE($1, name),
        frequency = COALESCE($2, frequency),
        recipients = COALESCE($3, recipients),
        site_id = COALESCE($4, site_id),
        report_type = COALESCE($5, report_type),
        is_active = COALESCE($6, is_active),
        exclude_alerts = COALESCE($7, exclude_alerts),
        exclude_onboard = COALESCE($8, exclude_onboard)
       WHERE id = $9 RETURNING *`,
      [name, frequency, recipients, siteId, reportType, isActive, excludeAlerts, excludeOnboard, req.params.id]
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

// GET /api/settings/update/status - Lightweight cached update status check
router.get('/update/status', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT update_available, last_update_check FROM system_settings LIMIT 1');
    const r = result.rows[0] || { update_available: false, last_update_check: null };
    res.json({
      updateAvailable: r.update_available === true,
      lastUpdateCheck: r.last_update_check
    });
  } catch (err) {
    console.error('[SETTINGS] GET Update Status error:', err);
    res.status(500).json({ error: 'Failed to retrieve update status' });
  }
});

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

// GET /api/settings/backup - Export database schema and temperature data as JSON
router.get('/backup', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const sites = await pool.query('SELECT * FROM sites ORDER BY id ASC');
    const rooms = await pool.query('SELECT * FROM rooms ORDER BY id ASC');
    const nodes = await pool.query('SELECT * FROM nodes ORDER BY id ASC');
    const sensorData = await pool.query('SELECT * FROM sensor_data ORDER BY id ASC');
    const smtpSettings = await pool.query('SELECT * FROM smtp_settings ORDER BY id ASC');
    const scheduledReports = await pool.query('SELECT * FROM scheduled_reports ORDER BY id ASC');

    const backup = {
      version: '1.1',
      generated_at: new Date().toISOString(),
      sites: sites.rows,
      rooms: rooms.rows,
      nodes: nodes.rows,
      sensor_data: sensorData.rows,
      smtp_settings: smtpSettings.rows,
      scheduled_reports: scheduledReports.rows,
    };

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=tempsense_backup_${dateStr}.json`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('[SETTINGS] Database backup error:', err);
    res.status(500).json({ error: 'Failed to generate database backup', details: err.message });
  }
});

// POST /api/settings/restore - Import database schema and data from JSON
router.post('/restore', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const backup = req.body;
    if (!backup || !backup.sites || !backup.rooms || !backup.nodes || !backup.sensor_data) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    await client.query('BEGIN');

    // WIPE tables in cascade order
    await client.query('TRUNCATE TABLE email_logs, alerts, sensor_data, nodes, rooms, sites, scheduled_reports, smtp_settings CASCADE');

    // 1. Restore sites
    for (const site of backup.sites) {
      await client.query(
        'INSERT INTO sites (id, account_id, name, location, created_at) VALUES ($1, $2, $3, $4, $5)',
        [site.id, site.account_id, site.name, site.location, site.created_at]
      );
    }

    // 2. Restore rooms
    for (const room of backup.rooms) {
      await client.query(
        'INSERT INTO rooms (id, site_id, name, created_at) VALUES ($1, $2, $3, $4)',
        [room.id, room.site_id, room.name, room.created_at]
      );
    }

    // 3. Restore nodes
    for (const node of backup.nodes) {
      await client.query(
        `INSERT INTO nodes (id, room_id, device_id, name, location, ip_address, tcp_port, sampling_interval, temp_high, temp_low, humidity_high, humidity_low, is_active, reboot_required, last_seen, notes, created_at, t1_name, t2_name, td_name, humidity_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          node.id, node.room_id, node.device_id, node.name, node.location,
          node.ip_address, node.tcp_port, node.sampling_interval,
          node.temp_high, node.temp_low, node.humidity_high, node.humidity_low,
          node.is_active, node.reboot_required, node.last_seen, node.notes, node.created_at,
          node.t1_name || 'DS18 #1', node.t2_name || 'DS18 #2', node.td_name || 'DHT Temp', node.humidity_name || 'Humidity'
        ]
      );
    }

    // 4. Restore sensor data
    for (const data of backup.sensor_data) {
      await client.query(
        'INSERT INTO sensor_data (id, node_id, t1, t2, td, humidity, recorded_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [data.id, data.node_id, data.t1, data.t2, data.td, data.humidity, data.recorded_at]
      );
    }

    // 5. Restore SMTP settings if present in backup
    if (backup.smtp_settings && backup.smtp_settings.length > 0) {
      for (const smtp of backup.smtp_settings) {
        await client.query(
          'INSERT INTO smtp_settings (id, use_custom, host, port, user_email, password, secure, sender_name, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [smtp.id, smtp.use_custom, smtp.host, smtp.port, smtp.user_email, smtp.password, smtp.secure, smtp.sender_name, smtp.updated_at]
        );
      }
    }

    // 6. Restore scheduled reports if present in backup
    if (backup.scheduled_reports && backup.scheduled_reports.length > 0) {
      for (const report of backup.scheduled_reports) {
        await client.query(
          'INSERT INTO scheduled_reports (id, name, frequency, recipients, site_id, report_type, is_active, last_run, created_at, exclude_alerts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [report.id, report.name, report.frequency, report.recipients, report.site_id, report.report_type, report.is_active, report.last_run, report.created_at, report.exclude_alerts || false]
        );
      }
    }

    // Reset SERIAL sequences
    await client.query("SELECT setval('sites_id_seq', COALESCE((SELECT MAX(id)+1 FROM sites), 1), false)");
    await client.query("SELECT setval('rooms_id_seq', COALESCE((SELECT MAX(id)+1 FROM rooms), 1), false)");
    await client.query("SELECT setval('nodes_id_seq', COALESCE((SELECT MAX(id)+1 FROM nodes), 1), false)");
    await client.query("SELECT setval('sensor_data_id_seq', COALESCE((SELECT MAX(id)+1 FROM sensor_data), 1), false)");
    await client.query("SELECT setval('smtp_settings_id_seq', COALESCE((SELECT MAX(id)+1 FROM smtp_settings), 1), false)");
    await client.query("SELECT setval('scheduled_reports_id_seq', COALESCE((SELECT MAX(id)+1 FROM scheduled_reports), 1), false)");

    await client.query('COMMIT');
    res.json({ success: true, message: 'Database successfully restored' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SETTINGS] Database restore error:', err);
    res.status(500).json({ error: 'Failed to restore database from backup', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/settings/gdrive - Fetch Google Drive sync configuration
router.get('/gdrive', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT use_sync, folder_id, last_sync, last_status FROM gdrive_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({ use_sync: false });
    }
    const r = result.rows[0];
    const connCheck = await pool.query('SELECT refresh_token FROM gdrive_settings WHERE id = 1');
    res.json({
      use_sync: r.use_sync === true,
      folder_id: r.folder_id || '',
      last_sync: r.last_sync,
      last_status: r.last_status,
      is_connected: !!(connCheck.rows[0]?.refresh_token)
    });
  } catch (err) {
    console.error('[SETTINGS] GET Google Drive error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/gdrive - Update Google Drive sync configuration
router.post('/gdrive', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { use_sync, folder_id } = req.body;
    
    await pool.query(
      `UPDATE gdrive_settings SET 
        use_sync = $1, 
        folder_id = $2,
        updated_at = NOW()
       WHERE id = 1`,
      [use_sync === true, folder_id ? folder_id.trim() : '']
    );

    res.json({ success: true, message: 'Google Drive settings updated successfully' });
  } catch (err) {
    console.error('[SETTINGS] POST Google Drive error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

const gdriveService = require('../services/gdriveService');

// POST /api/settings/gdrive/auth-url - Get Google consent page URL
router.post('/gdrive/auth-url', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { redirectUri } = req.body;
    if (!redirectUri) {
      return res.status(400).json({ error: 'redirectUri is required' });
    }
    const url = await gdriveService.getAuthUrl(redirectUri);
    res.json({ url });
  } catch (err) {
    console.error('[SETTINGS] Auth URL error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate consent URL' });
  }
});

// POST /api/settings/gdrive/exchange - Exchange code for refresh token
router.post('/gdrive/exchange', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'code and redirectUri are required' });
    }
    const result = await gdriveService.exchangeCode(code, redirectUri);
    res.json(result);
  } catch (err) {
    console.error('[SETTINGS] Token exchange error:', err);
    res.status(500).json({ error: err.message || 'Failed to exchange authorization code' });
  }
});

// POST /api/settings/gdrive/test - Test connection
router.post('/gdrive/test', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await gdriveService.testConnection();
    res.json(result);
  } catch (err) {
    console.error('[SETTINGS] Test connection error:', err);
    res.status(500).json({ error: err.message || 'Connection test failed' });
  }
});

// POST /api/settings/gdrive/sync - Manually trigger database backup to Google Drive
router.post('/gdrive/sync', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await gdriveService.uploadBackup();
    res.json(result);
  } catch (err) {
    console.error('[SETTINGS] Manual backup sync error:', err);
    res.status(500).json({ error: err.message || 'Backup synchronization failed' });
  }
});

// POST /api/settings/gdrive/disconnect - Disconnect Google account and disable sync
router.post('/gdrive/disconnect', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE gdrive_settings SET 
        refresh_token = '', 
        use_sync = FALSE, 
        last_status = 'Disconnected', 
        updated_at = NOW() 
       WHERE id = 1`
    );
    res.json({ success: true, message: 'Google account disconnected' });
  } catch (err) {
    console.error('[SETTINGS] Disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

module.exports = router;

