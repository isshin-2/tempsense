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


// ===== Start =====
async function start() {
  await initDB();
  
  // Start Report Scheduler
  startReportScheduler();

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
