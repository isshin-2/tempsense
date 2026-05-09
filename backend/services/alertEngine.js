const nodemailer = require('nodemailer');
const pool = require('../db/pool');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Check if an alert was already sent for this node within the last hour.
 * If not, send the email and log it.
 */
async function checkAndAlert(nodeId, nodeName, roomName, siteName, readings) {
  try {
    // Fetch node thresholds
    const nodeRes = await pool.query('SELECT * FROM nodes WHERE id = $1', [nodeId]);
    if (nodeRes.rows.length === 0) return;
    const node = nodeRes.rows[0];

    const breaches = [];

    // Check each temperature field
    const tempFields = [
      { key: 't1', label: 'DS18 Probe 1', value: readings.t1 },
      { key: 't2', label: 'DS18 Probe 2', value: readings.t2 },
      { key: 'td', label: 'DHT Temperature', value: readings.td },
    ];

    for (const f of tempFields) {
      if (f.value !== null && f.value !== undefined) {
        if (f.value > node.temp_high) {
          breaches.push(`${f.label}: ${f.value.toFixed(1)}°C (HIGH > ${node.temp_high}°C)`);
        } else if (f.value < node.temp_low) {
          breaches.push(`${f.label}: ${f.value.toFixed(1)}°C (LOW < ${node.temp_low}°C)`);
        }
      }
    }

    // Check humidity
    if (readings.humidity !== null && readings.humidity !== undefined) {
      if (readings.humidity > node.humidity_high) {
        breaches.push(`Humidity: ${readings.humidity.toFixed(1)}% (HIGH > ${node.humidity_high}%)`);
      } else if (readings.humidity < node.humidity_low) {
        breaches.push(`Humidity: ${readings.humidity.toFixed(1)}% (LOW < ${node.humidity_low}%)`);
      }
    }

    if (breaches.length === 0) return;

    // Check: was an alert sent for this node in the last hour?
    const recentAlert = await pool.query(
      `SELECT id FROM alerts WHERE node_id = $1 AND sent_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
      [nodeId]
    );

    if (recentAlert.rows.length > 0) {
      console.log(`[ALERT] Suppressed (already sent within 1h) for node ${nodeId}`);
      return;
    }

    const alertType = 'threshold_breach';
    const message = breaches.join('\n');
    const recipient = process.env.ALERT_TO || 'admin@maxworth.in';

    const emailBody = `
⚠️ TEMPSENSE THRESHOLD ALERT

Site: ${siteName}
Room: ${roomName}
Node: ${nodeName} (Device ID: ${node.device_id})
Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Breached Parameters:
${breaches.map(b => `  • ${b}`).join('\n')}

---
This is an automated alert from the Tempsense Monitoring System.
Maxworth Techserv
    `.trim();

    // Send email
    try {
      await transporter.sendMail({
        from: process.env.ALERT_FROM || 'alerts@tempsense.io',
        to: recipient,
        subject: `🚨 TMS Alert: ${nodeName} @ ${siteName} - Threshold Breach`,
        text: emailBody,
      });
      console.log(`[ALERT] Email sent to ${recipient} for node ${nodeId}`);
    } catch (emailErr) {
      console.error('[ALERT] Email send failed:', emailErr.message);
    }

    // Log the alert regardless of email success
    await pool.query(
      'INSERT INTO alerts (node_id, alert_type, message, sent_to) VALUES ($1, $2, $3, $4)',
      [nodeId, alertType, message, recipient]
    );

  } catch (err) {
    console.error('[ALERT] Engine error:', err.message);
  }
}

module.exports = { checkAndAlert };
