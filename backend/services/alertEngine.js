const pool = require('../db/pool');
const { sendEmail } = require('./emailService');

/**
 * Check if an alert was already sent for this node within the last hour.
 * If not, send the email and log it.
 */
async function checkAndAlert(nodeId, nodeName, roomName, siteName, readings) {
  try {
    // Fetch node thresholds and custom names
    const nodeRes = await pool.query('SELECT * FROM nodes WHERE id = $1', [nodeId]);
    if (nodeRes.rows.length === 0) return;
    const node = nodeRes.rows[0];

    const breaches = [];

    // Check each temperature field using custom sensor labels
    const tempFields = [
      { key: 't1', label: node.t1_name || 'DS18 Probe 1', value: readings.t1 },
      { key: 't2', label: node.t2_name || 'DS18 Probe 2', value: readings.t2 },
      { key: 'td', label: node.td_name || 'DHT Temperature', value: readings.td },
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

    // Check humidity using custom sensor label
    if (readings.humidity !== null && readings.humidity !== undefined) {
      const humLabel = node.humidity_name || 'Humidity';
      if (readings.humidity > node.humidity_high) {
        breaches.push(`${humLabel}: ${readings.humidity.toFixed(1)}% (HIGH > ${node.humidity_high}%)`);
      } else if (readings.humidity < node.humidity_low) {
        breaches.push(`${humLabel}: ${readings.humidity.toFixed(1)}% (LOW < ${node.humidity_low}%)`);
      }
    }

    if (breaches.length === 0) return;

    // Check: was an alert sent for this node within the configured alert cooldown interval?
    const settingsRes = await pool.query('SELECT alert_cooldown FROM smtp_settings LIMIT 1');
    const cooldownMins = settingsRes.rows[0]?.alert_cooldown || 60;

    const recentAlert = await pool.query(
      `SELECT id FROM alerts WHERE node_id = $1 AND sent_at > NOW() - ($2 * INTERVAL '1 minute') LIMIT 1`,
      [nodeId, cooldownMins]
    );

    if (recentAlert.rows.length > 0) {
      console.log(`[ALERT] Suppressed (already sent within 1h) for node ${nodeId}`);
      return;
    }

    const alertType = 'threshold_breach';
    const message = breaches.join('\n');
    
    // Fetch global alert recipient from settings or env
    const smtpRes = await pool.query('SELECT user_email FROM smtp_settings LIMIT 1');
    const recipient = smtpRes.rows[0]?.user_email || process.env.ALERT_TO || 'admin@maxworth.in';

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
    `.trim();

    // Send email via emailService
    try {
      await sendEmail({
        to: recipient,
        subject: `🚨 TEMPSENSE Alert: ${nodeName} @ ${siteName} - Threshold Breach`,
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
