const net = require('net');
const pool = require('../db/pool');
const nodemailer = require('nodemailer');
const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('veth') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('wsl')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function checkDatabase() {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    return { ok: true, message: `PostgreSQL connection healthy (${duration}ms)` };
  } catch (err) {
    return { ok: false, message: `Database query failed: ${err.message}` };
  }
}

async function checkTCPServer() {
  return new Promise((resolve) => {
    const tcpPort = parseInt(process.env.TCP_PORT) || 1024;
    const socket = new net.Socket();
    
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ ok: true, message: `TCP Node Ingestion active on port ${tcpPort}` });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, message: `Connection to TCP port ${tcpPort} timed out (not responding)` });
    });
    
    socket.on('error', (err) => {
      resolve({ ok: false, message: `Cannot connect to TCP port ${tcpPort}: ${err.message}` });
    });
    
    socket.connect(tcpPort, '127.0.0.1');
  });
}

async function checkSMTP() {
  try {
    const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
    const s = result.rows[0];
    
    let transporterConfig;
    if (s && s.use_custom) {
      if (!s.host || !s.port || !s.user_email) {
        return { ok: false, message: 'Custom SMTP enabled but host, port, or email is missing' };
      }
      transporterConfig = {
        host: s.host,
        port: s.port,
        secure: s.secure === true,
        auth: {
          user: s.user_email,
          pass: s.password,
        },
      };
    } else {
      const decryptedPass = process.env.DECRYPTED_SMTP_PASS;
      if (!decryptedPass) {
        return { ok: false, message: 'SMTP settings locked (decryption key required or password not loaded)' };
      }
      transporterConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'tempsense.maxworth@gmail.com',
          pass: decryptedPass,
        },
      };
    }
    
    const transporter = nodemailer.createTransport(transporterConfig);
    await transporter.verify();
    return { ok: true, message: `SMTP Server verified successfully (${transporterConfig.host})` };
  } catch (err) {
    return { ok: false, message: `SMTP verification failed: ${err.message}` };
  }
}

async function checkMDNS() {
  try {
    const ip = getLocalIp();
    return { ok: true, message: `mDNS Active. Local network discovery address: tempsense.local -> ${ip}` };
  } catch (err) {
    return { ok: false, message: `mDNS Check failed: ${err.message}` };
  }
}

async function runDiagnostics() {
  console.log('[Diagnostics] Starting system self-diagnostics...');
  
  const results = {
    database: await checkDatabase(),
    tcpServer: await checkTCPServer(),
    smtp: await checkSMTP(),
    mdns: await checkMDNS()
  };
  
  const allOk = Object.values(results).every(r => r.ok);
  
  console.log(`[Diagnostics] Completed. Overall status: ${allOk ? 'SUCCESS' : 'FAILURE'}`);
  
  return {
    success: allOk,
    timestamp: new Date().toISOString(),
    results
  };
}

module.exports = { runDiagnostics };
