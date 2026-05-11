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

    console.log('[DB] Schema applied and migrations checked');

    // Seed default super admin if no users exist
    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users (account_id, email, password, name, role)
         VALUES (1, 'admin@maxworth.in', $1, 'Super Admin', 'super_admin')`,
        [hashed]
      );
      console.log('[DB] Default admin created: admin@maxworth.in / admin123');
    }
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
