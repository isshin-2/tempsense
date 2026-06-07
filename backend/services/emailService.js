const nodemailer = require('nodemailer');
const pool = require('../db/pool');

async function getTransporter() {
  const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
  const s = result.rows[0];

  if (s && s.use_custom) {
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

  // Fallback to default Gmail SMTP
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'tempsense.maxworth@gmail.com',
      pass: process.env.DECRYPTED_SMTP_PASS,
    },
  });
}

async function sendEmail({ to, subject, text, html, attachments }) {
  try {
    const transporter = await getTransporter();
    const result = await pool.query('SELECT use_custom, sender_name, user_email FROM smtp_settings LIMIT 1');
    const s = result.rows[0];
    
    let sender;
    if (s && s.use_custom) {
      sender = `"${s.sender_name || 'Tempsense Alerts'}" <${s.user_email}>`;
    } else {
      const senderName = (s && s.sender_name) || 'Tempsense Alerts';
      sender = `"${senderName}" <tempsense.maxworth@gmail.com>`;
    }

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
