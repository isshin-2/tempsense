const net = require('net');
const pool = require('../db/pool');
const { checkAndAlert } = require('./alertEngine');

let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

/**
 * Start the TCP listener that ingests sensor JSON payloads.
 *
 * Expected format (newline-terminated JSON):
 *   {"t1": 24.50, "t2": 24.80, "td": 25.10, "h": 45.00, "deviceId": 1}
 */
function startTCPServer(port) {
  const server = net.createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP] Connection from ${remoteAddr}`);

    let buffer = '';

    socket.on('data', async (chunk) => {
      buffer += chunk.toString();

      // Process all complete lines in the buffer
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (line.length === 0) continue;

        try {
          const payload = JSON.parse(line);
          await processPayload(payload, remoteAddr);
        } catch (err) {
          console.error(`[TCP] Parse error from ${remoteAddr}:`, err.message, '| Raw:', line.substring(0, 100));
        }
      }
    });

    socket.on('end', () => {
      // Process any remaining data in buffer (no trailing newline)
      if (buffer.trim().length > 0) {
        try {
          const payload = JSON.parse(buffer.trim());
          processPayload(payload, remoteAddr);
        } catch (err) {
          console.error(`[TCP] Final parse error from ${remoteAddr}:`, err.message);
        }
      }
      console.log(`[TCP] Disconnected: ${remoteAddr}`);
    });

    socket.on('error', (err) => {
      console.error(`[TCP] Socket error from ${remoteAddr}:`, err.message);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[TCP] Listener active on port ${port}`);
  });

  server.on('error', (err) => {
    console.error('[TCP] Server error:', err.message);
  });

  return server;
}

/**
 * Process a single parsed JSON payload from a sensor node.
 */
async function processPayload(payload, remoteAddr) {
  const { t1, t2, td, h, deviceId } = payload;

  if (deviceId === undefined || deviceId === null) {
    console.warn(`[TCP] Payload missing deviceId from ${remoteAddr}`);
    return;
  }

  console.log(`[TCP] Device ${deviceId}: t1=${t1}, t2=${t2}, td=${td}, h=${h}`);

  try {
    // Look up the node by device_id
    const nodeRes = await pool.query(
      `SELECT n.id, n.name, n.device_id, r.name as room_name, r.id as room_id, s.name as site_name, s.id as site_id
       FROM nodes n
       JOIN rooms r ON n.room_id = r.id
       JOIN sites s ON r.site_id = s.id
       WHERE n.device_id = $1 AND n.is_active = TRUE`,
      [deviceId]
    );

    if (nodeRes.rows.length === 0) {
      console.warn(`[TCP] Unknown device_id ${deviceId} — not registered in system`);
      return;
    }

    const node = nodeRes.rows[0];

    // Insert sensor data
    await pool.query(
      'INSERT INTO sensor_data (node_id, t1, t2, td, humidity) VALUES ($1, $2, $3, $4, $5)',
      [node.id, t1 ?? null, t2 ?? null, td ?? null, h ?? null]
    );

    // Update last_seen
    await pool.query('UPDATE nodes SET last_seen = NOW() WHERE id = $1', [node.id]);

    // Broadcast to WebSocket clients
    if (io) {
      io.emit('sensorData', {
        nodeId: node.id,
        deviceId: node.device_id,
        nodeName: node.name,
        roomName: node.room_name,
        roomId: node.room_id,
        siteName: node.site_name,
        siteId: node.site_id,
        t1: t1 ?? null,
        t2: t2 ?? null,
        td: td ?? null,
        humidity: h ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    // Run alert engine
    await checkAndAlert(node.id, node.name, node.room_name, node.site_name, {
      t1: t1 ?? null,
      t2: t2 ?? null,
      td: td ?? null,
      humidity: h ?? null,
    });

  } catch (err) {
    console.error('[TCP] DB processing error:', err.message);
  }
}

module.exports = { startTCPServer, setSocketIO };
