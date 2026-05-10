const pool = require('./db/pool');
async function check() {
  try {
    const nodes = await pool.query('SELECT * FROM nodes');
    const rooms = await pool.query('SELECT * FROM rooms');
    const sites = await pool.query('SELECT * FROM sites');
    console.log("NODES:", nodes.rows);
    console.log("ROOMS:", rooms.rows);
    console.log("SITES:", sites.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
