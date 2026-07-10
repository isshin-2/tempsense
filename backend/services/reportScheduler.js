const pool = require('../db/pool');
const { generateReport } = require('./pdfGenerator');
const { sendEmail } = require('./emailService');
const { stringify } = require('csv-stringify/sync');
const path = require('path');
const fs = require('fs');

/**
 * Check for scheduled reports that need to be sent.
 * Runs every minute.
 */
async function startReportScheduler() {
  console.log('[SCHEDULER] Started report scheduler');
  
  // Check every 5 minutes for reports
  setInterval(async () => {
    try {
      await processSchedules();
    } catch (err) {
      console.error('[SCHEDULER] Process error:', err);
    }
  }, 5 * 60 * 1000);

  // Check for auto Google Drive backups every 15 minutes
  setInterval(async () => {
    try {
      await processGDriveBackup();
    } catch (err) {
      console.error('[SCHEDULER] GDrive auto backup error:', err);
    }
  }, 15 * 60 * 1000);
}

async function processGDriveBackup() {
  try {
    const result = await pool.query('SELECT use_sync, last_sync, refresh_token FROM gdrive_settings WHERE id = 1');
    const s = result.rows[0];
    if (!s || !s.use_sync || !s.refresh_token) {
      return;
    }

    const now = new Date();
    if (s.last_sync) {
      const lastSync = new Date(s.last_sync);
      const diffHours = (now - lastSync) / (1000 * 60 * 60);
      if (diffHours < 23) {
        return; // Already backed up recently
      }
    }

    console.log('[SCHEDULER] Starting automated backup upload to Google Drive...');
    const gdriveService = require('./gdriveService');
    await gdriveService.uploadBackup();
    console.log('[SCHEDULER] Automated Google Drive backup uploaded successfully.');
  } catch (err) {
    console.error('[SCHEDULER] Automated Google Drive backup failed:', err.message);
  }
}


async function processSchedules() {
  const now = new Date();
  
  // Fetch active schedules
  const res = await pool.query(`
    SELECT sr.*, s.name as site_name 
    FROM scheduled_reports sr
    JOIN sites s ON sr.site_id = s.id
    WHERE sr.is_active = TRUE
  `);
  
  for (const s of res.rows) {
    if (shouldRun(s, now)) {
      await runReport(s);
    }
  }
}

function shouldRun(schedule, now) {
  if (!schedule.last_run) return true;
  
  const lastRun = new Date(schedule.last_run);
  const diffHours = (now - lastRun) / (1000 * 60 * 60);
  
  switch (schedule.frequency) {
    case 'daily':
      return diffHours >= 23;
    case 'weekly':
      return diffHours >= 24 * 7 - 1;
    case 'monthly':
      return diffHours >= 24 * 30 - 1;
    default:
      return false;
  }
}

async function runReport(s) {
  console.log(`[SCHEDULER] Running report: ${s.name}`);
  
  try {
    const endDate = new Date().toISOString();
    let startDate;
    
    if (s.frequency === 'daily') startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    else if (s.frequency === 'weekly') startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    else startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const attachments = [];
    const dateStr = new Date().toISOString().split('T')[0];

    // Generate PDF if needed
    if (s.report_type === 'pdf' || s.report_type === 'both') {
      const pdfBuffer = await generateReport({ 
        siteId: s.site_id, 
        startDate, 
        endDate, 
        isInternal: true,
        excludeAlerts: s.exclude_alerts,
        excludeOnboard: s.exclude_onboard
      });
      attachments.push({
        filename: `tempsense_report_${dateStr}.pdf`,
        content: pdfBuffer
      });
    }

    // Generate CSV if needed
    if (s.report_type === 'csv' || s.report_type === 'both') {
      const csvData = await getCSVData(s.site_id, startDate, endDate, s.exclude_alerts, s.exclude_onboard);
      attachments.push({
        filename: `tempsense_report_${dateStr}.csv`,
        content: csvData
      });
    }

    // Send Email
    await sendEmail({
      to: s.recipients,
      subject: `📊 Automated Report: ${s.name} (${s.frequency})`,
      text: `Please find the attached automated report for ${s.site_name}.\n\nPeriod: ${startDate.split('T')[0]} to ${endDate.split('T')[0]}\n\nThis is an automated message from Tempsense.`,
      attachments
    });

    // Update last_run
    await pool.query('UPDATE scheduled_reports SET last_run = NOW() WHERE id = $1', [s.id]);
    
    console.log(`[SCHEDULER] Successfully sent report: ${s.name}`);
    
    // Log success
    await pool.query(
      'INSERT INTO email_logs (type, recipient, status, sent_at) VALUES ($1, $2, $3, NOW())',
      ['scheduled_report', s.recipients, 'success']
    );

  } catch (err) {
    console.error(`[SCHEDULER] Failed to run report ${s.name}:`, err);
    // Log failure
    await pool.query(
      'INSERT INTO email_logs (type, recipient, status, error_message, sent_at) VALUES ($1, $2, $3, $4, NOW())',
      ['scheduled_report', s.recipients, 'failure', err.message]
    );
  }
}

async function getCSVData(siteId, startDate, endDate, excludeAlerts, excludeOnboard) {
  const query = `
    SELECT sd.recorded_at, n.name as node_name, n.device_id, r.name as room_name,
           sd.t1, sd.t2, sd.td, sd.humidity, n.temp_high, n.temp_low, n.humidity_high, n.humidity_low,
           n.t1_name, n.t2_name, n.td_name, n.humidity_name
    FROM sensor_data sd
    JOIN nodes n ON sd.node_id = n.id
    JOIN rooms r ON n.room_id = r.id
    WHERE r.site_id = $1 AND sd.recorded_at >= $2 AND sd.recorded_at <= $3
    ORDER BY sd.recorded_at ASC
  `;
  const result = await pool.query(query, [siteId, startDate, endDate]);
  
  const csvData = [];
  for (const r of result.rows) {
    const alerts = [];
    if (r.t1 > r.temp_high) alerts.push('T1 High');
    if (r.t1 < r.temp_low) alerts.push('T1 Low');
    if (r.t2 > r.temp_high) alerts.push('T2 High');
    if (r.t2 < r.temp_low) alerts.push('T2 Low');
    
    if (!excludeOnboard) {
      if (r.td > r.temp_high) alerts.push('DHT High');
      if (r.td < r.temp_low) alerts.push('DHT Low');
      if (r.humidity > r.humidity_high) alerts.push('Hum High');
      if (r.humidity < r.humidity_low) alerts.push('Hum Low');
    }

    if (excludeAlerts && alerts.length > 0) {
      continue;
    }

    const row = {
      Timestamp: new Date(r.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      Node: r.node_name,
      DeviceID: r.device_id,
      Room: r.room_name,
      T1: r.t1 !== null ? r.t1.toFixed(2) : '',
      T2: r.t2 !== null ? r.t2.toFixed(2) : '',
      Status: alerts.length > 0 ? alerts.join(', ') : 'Normal'
    };

    if (!excludeOnboard) {
      row.DHT = r.td !== null ? r.td.toFixed(2) : '';
      row.Humidity = r.humidity !== null ? r.humidity.toFixed(2) : '';
    }

    csvData.push(row);
  }

  const csvColumns = [
    { key: 'Timestamp', header: 'Timestamp' },
    { key: 'Node', header: 'Node' },
    { key: 'DeviceID', header: 'DeviceID' },
    { key: 'Room', header: 'Room' },
    { key: 'T1', header: 'T1 (°C)' },
    { key: 'T2', header: 'T2 (°C)' },
    ...(!excludeOnboard ? [
      { key: 'DHT', header: 'DHT Temp (°C)' },
      { key: 'Humidity', header: 'Humidity (%)' }
    ] : []),
    { key: 'Status', header: 'Alerts/Status' },
  ];

  return stringify(csvData, { header: true, columns: csvColumns });
}

module.exports = { startReportScheduler, runReport };
