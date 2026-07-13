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
const { startTCPServer, setSocketIO, setLockedStateProvider } = require('./services/tcpServer');
const { startMDNS } = require('./services/mdnsService');
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

let isLocked = true;

function tryUnlock(rawKey) {
  if (!rawKey) return false;
  const decodedKey = decodeCaesar(rawKey, 28);
  const decrypted = decryptSMTPPassword(decodedKey);
  if (decrypted === 'kqqt sqsq exfk ljdx') {
    process.env.DECRYPTED_SMTP_PASS = decrypted;
    process.env.SYSTEM_DECRYPTION_KEY = decodedKey;
    return true;
  }
  return false;
}

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
app.use(express.json({ limit: '50mb' }));

// Lock middleware to intercept requests
const lockMiddleware = (req, res, next) => {
  // Only lock API endpoints
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Allow health check, status check, and unlock requests
  if (
    req.path === '/api/health' ||
    req.path === '/api/auth/status' ||
    req.path === '/api/auth/unlock' ||
    req.path === '/api/auth/company/public'
  ) {
    return next();
  }
  
  if (isLocked) {
    return res.status(423).json({ error: 'Server is locked. SMTP decryption key required.', locked: true });
  }
  
  next();
};

app.use(lockMiddleware);

// Helper to initialize all services once the database is unlocked
async function setupUnlockedServices() {
  await initDB();
  startReportScheduler();
  try {
    const { startAutoUpdateScheduler } = require('./services/autoUpdater');
    startAutoUpdateScheduler();
  } catch (err) {
    console.error('[SERVER] Failed to start auto updater:', err.message);
  }
}

// API Status & Unlock Routes
app.get('/api/auth/status', (req, res) => {
  res.json({ locked: isLocked });
});

app.post('/api/auth/unlock', async (req, res) => {
  const { decryptionKey } = req.body;
  if (!decryptionKey) {
    return res.status(400).json({ error: 'Decryption key is required' });
  }

  if (!isLocked) {
    return res.json({ success: true, message: 'Server is already unlocked' });
  }

  if (tryUnlock(decryptionKey)) {
    try {
      isLocked = false;
      await setupUnlockedServices();
      console.log('[SMTP] Server successfully UNLOCKED via API.');
      return res.json({ success: true, message: 'Server successfully unlocked' });
    } catch (dbErr) {
      isLocked = true; // Rollback
      return res.status(500).json({ error: 'Failed to initialize system services after unlock', details: dbErr.message });
    }
  }

  res.status(400).json({ error: 'Invalid decryption key' });
});

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
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS t1_name VARCHAR(100) DEFAULT 'DS18 #1'`);
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS t2_name VARCHAR(100) DEFAULT 'DS18 #2'`);
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS td_name VARCHAR(100) DEFAULT 'DHT Temp'`);
    await pool.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS humidity_name VARCHAR(100) DEFAULT 'Humidity'`);
    await pool.query(`ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS exclude_alerts BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS alert_cooldown INT DEFAULT 60`);
    await pool.query(`ALTER TABLE gdrive_settings ADD COLUMN IF NOT EXISTS sync_interval INT DEFAULT 24`);
    
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

    // Create system_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id                     SERIAL PRIMARY KEY,
        auto_update_enabled    BOOLEAN DEFAULT TRUE,
        auto_update_interval   INT DEFAULT 24, -- in hours
        last_update_check      TIMESTAMP,
        update_available       BOOLEAN DEFAULT FALSE,
        updated_at             TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed default system settings if table is empty
    const settingsCheck = await pool.query('SELECT COUNT(*) FROM system_settings');
    if (parseInt(settingsCheck.rows[0].count) === 0) {
      await pool.query('INSERT INTO system_settings (auto_update_enabled, auto_update_interval) VALUES (TRUE, 24)');
      console.log('[DB] Default system settings seeded');
    }


    // Add columns and drop not null constraints on smtp_settings for custom configuration fallback
    try {
      await pool.query('ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS use_custom BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN host DROP NOT NULL');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN port DROP NOT NULL');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN user_email DROP NOT NULL');
      await pool.query('ALTER TABLE smtp_settings ALTER COLUMN password DROP NOT NULL');
      
      // Migration for scheduled_reports exclude_onboard column
      await pool.query('ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS exclude_onboard BOOLEAN DEFAULT FALSE');
      
      // Migration for system_settings update_available column
      await pool.query('ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS update_available BOOLEAN DEFAULT FALSE');
      
      // Migration for smtp_settings alert_recipient column
      await pool.query('ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS alert_recipient VARCHAR(255)');
    } catch (e) {
      console.error('[DB] Database migrations error:', e.message);
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
  if (process.env.SMTP_DECRYPTION_KEY) {
    if (tryUnlock(process.env.SMTP_DECRYPTION_KEY)) {
      console.log('[SMTP] Decryption key accepted from environment. Default SMTP enabled.');
      isLocked = false;
      return true;
    } else {
      console.error('[SMTP] Invalid SMTP_DECRYPTION_KEY in environment.');
    }
  }

  // Try interactive prompt if terminal is interactive
  if (process.stdin.isTTY) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const rawKey = await askDecryptionKey();
        if (tryUnlock(rawKey)) {
          console.log('[SMTP] Decryption key accepted. Default SMTP enabled.');
          isLocked = false;
          return true;
        }
        console.error(`[SMTP] Invalid decryption key. (${2 - attempts} attempts remaining)`);
        attempts++;
      } catch (err) {
        console.error(`[SMTP] ${err.message}`);
        break;
      }
    }
  }

  console.log('[SMTP] Server started in LOCKED mode. Please unlock via the frontend or API.');
  isLocked = true;
  return false;
}

// ===== Start =====
async function start() {
  setLockedStateProvider(() => isLocked);
  startMDNS();

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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n====================================`);
    console.log(`  TEMPSENSE Server`);
    console.log(`  HTTP API:  http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}`);
    console.log(`  TCP Port:  ${TCP_PORT}`);
    if (isLocked) {
      console.log(`  [STATUS]   SYSTEM IS LOCKED (decryption required)`);
    }
    console.log(`====================================\n`);

    // Initialize key prompt/auto-unlock asynchronously
    initializeSMTPKey().then(async (unlocked) => {
      if (unlocked) {
        try {
          await setupUnlockedServices();
        } catch (err) {
          console.error('[SERVER] System initialization failed on startup:', err.message);
        }
      }
    }).catch((err) => {
      console.error('[SERVER] SMTP key initialization failed:', err.message);
    });
  });

  startTCPServer(TCP_PORT);
}

const path = require('path');
const fs = require('fs');

// Serve static assets from frontend build
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  // Serve index.html for all non-API GET requests
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

start();
