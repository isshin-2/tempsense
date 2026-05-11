const nodemailer = require('nodemailer');
const pool = require('../db/pool');

async function getTransporter() {
  const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
  if (result.rows.length === 0) {
    // Fallback to env
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const s = result.rows[0];
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: {
      user: s.user_email,
      pass: s.password,
    },
  });
}

async function sendEmail({ to, subject, text, html, attachments }) {
  try {
    const transporter = await getTransporter();
    const result = await pool.query('SELECT sender_name, user_email FROM smtp_settings LIMIT 1');
    const sender = result.rows[0] ? `"${result.rows[0].sender_name}" <${result.rows[0].user_email}>` : process.env.SMTP_USER;

    const info = await transporter.sendMail({
      from: sender,
      to,
      subject,
      text,
      html,
      attachments,
    });

    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    
    // Log success
    await pool.query(
      'INSERT INTO email_logs (type, recipient, status, sent_at) VALUES ($1, $2, $3, NOW())',
      ['general', to, 'success']
    );

    return info;
  } catch (err) {
    console.error('[EMAIL] Send error:', err);
    
    // Log failure
    await pool.query(
      'INSERT INTO email_logs (type, recipient, status, error_message, sent_at) VALUES ($1, $2, $3, $4, NOW())',
      ['general', to, 'failure', err.message]
    );
    throw err;
  }
}

module.exports = { sendEmail };
