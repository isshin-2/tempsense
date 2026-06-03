/**
 * TEMPSENSE Companion Server
 * - Compiles firmware via PlatformIO
 * - Uploads firmware.bin + version.json to GitHub tempsense_ota branch
 */

require('dotenv').config();
const express        = require('express');
const { spawn, execSync } = require('child_process');
const path           = require('path');
const fs             = require('fs');
const fetch          = require('node-fetch');

// ─── Find PlatformIO executable ────────────────────────────────────────────────
// Try in order: PATH → AppData Scripts → python -m platformio
function findPio() {
  const candidates = [
    'pio',
    path.join(process.env.APPDATA || '', 'Python', 'Scripts', 'pio.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'Scripts', 'pio.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'pio.exe'),
    path.join(process.env.USERPROFILE || '', '.platformio', 'penv', 'Scripts', 'platformio.exe'),
  ];
  for (const c of candidates) {
    try { execSync(`"${c}" --version`, { stdio: 'ignore' }); return c; }
    catch {}
  }
  return null;  // fallback: python -m platformio
}

// Find Python — needed as fallback if pio not in PATH
function findPython() {
  const candidates = ['python', 'python3',
    'C:\\Users\\krithik\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
    'C:\\Users\\krithik\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
  ];
  for (const c of candidates) {
    try { execSync(`"${c}" --version`, { stdio: 'ignore' }); return c; }
    catch {}
  }
  return 'python';  // last resort
}

const PIO_CMD    = findPio();
const PYTHON_CMD = findPython();

const app   = express();
const PORT  = process.env.PORT || 3000;

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_REPO   = process.env.GITHUB_REPO  || 'isshin-2/tempsense';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'tempsense_ota';
const FIRMWARE_DIR  = process.env.FIRMWARE_DIR  ||
                      'c:\\Users\\krithik\\Documents\\Arduino\\TEMPSENSE';

// Built binary location (PlatformIO default for seeed_xiao_esp32c3)
const BIN_PATH = path.join(
  FIRMWARE_DIR,
  '.pio', 'build', 'seeed_xiao_esp32c3', 'firmware.bin'
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SSE helper ────────────────────────────────────────────────────────────────
// Sends real-time build log lines to the browser via Server-Sent Events
function sseLog(res, msg, type = 'log') {
  res.write(`data: ${JSON.stringify({ type, msg })}\n\n`);
}

// ─── GitHub API helpers ────────────────────────────────────────────────────────
const GH_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents`;

async function ghGetSHA(filePath) {
  const url = `${GH_BASE}/${filePath}?ref=${GITHUB_BRANCH}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    }
  });
  if (r.status === 200) {
    const j = await r.json();
    return j.sha;
  }
  if (r.status === 404) {
    return null;   // file does not exist yet
  }
  const errText = await r.text();
  throw new Error(`GitHub API returned status ${r.status} when fetching SHA: ${errText}`);
}

async function ghPutFile(filePath, content, message) {
  const sha  = await ghGetSHA(filePath);
  const body = {
    message,
    branch:  GITHUB_BRANCH,
    content: Buffer.from(content).toString('base64'),
  };
  if (sha) body.sha = sha;   // required for update

  const url = `${GH_BASE}/${filePath}`;
  const r = await fetch(url, {
    method:  'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`GitHub PUT failed (${r.status}): ${err}`);
  }
  return await r.json();
}

// ─── GET /api/status  –  quick health check ────────────────────────────────────
app.get('/api/status', (req, res) => {
  const binExists = fs.existsSync(BIN_PATH);
  const binSize   = binExists ? fs.statSync(BIN_PATH).size : 0;
  const binMtime  = binExists ? fs.statSync(BIN_PATH).mtime : null;
  res.json({
    ok:       true,
    repo:     GITHUB_REPO,
    branch:   GITHUB_BRANCH,
    firmwareDir: FIRMWARE_DIR,
    binExists,
    binSize,
    binMtime,
  });
});

// ─── GET /api/build  –  run pio run, stream log via SSE ───────────────────────
app.get('/api/build', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseLog(res, `📦 Starting PlatformIO build…`);
  sseLog(res, `📁 Project: ${FIRMWARE_DIR}`);

  if (!PIO_CMD) {
    sseLog(res, '⚠️  "pio" not found in PATH — trying "python -m platformio"…', 'warn');
  } else {
    sseLog(res, `🔧 PlatformIO: ${PIO_CMD}`);
  }

  // Remove stale binary so we don't accidentally upload an old one
  if (fs.existsSync(BIN_PATH)) fs.unlinkSync(BIN_PATH);

  const args = PIO_CMD
    ? [PIO_CMD, ['run', '--project-dir', FIRMWARE_DIR], { shell: true, env: { ...process.env } }]
    : [PYTHON_CMD, ['-m', 'platformio', 'run', '--project-dir', FIRMWARE_DIR], { shell: true, env: { ...process.env } }];

  const pio = spawn(...args);

  pio.stdout.on('data', d => {
    const lines = d.toString().split('\n');
    lines.forEach(l => { if (l.trim()) sseLog(res, l); });
  });
  pio.stderr.on('data', d => {
    const lines = d.toString().split('\n');
    lines.forEach(l => { if (l.trim()) sseLog(res, l, 'warn'); });
  });

  pio.on('close', code => {
    if (code === 0) {
      const size = fs.existsSync(BIN_PATH)
        ? (fs.statSync(BIN_PATH).size / 1024).toFixed(1) + ' KB'
        : 'unknown';
      sseLog(res, `✅ Build SUCCESS  –  Binary: ${size}`, 'success');
    } else {
      sseLog(res, `❌ Build FAILED  (exit ${code})`, 'error');
    }
    res.write('data: {"type":"done","code":' + code + '}\n\n');
    res.end();
  });

  req.on('close', () => pio.kill());
});

// ─── POST /api/upload  –  push binary + version.json to GitHub ─────────────────
app.post('/api/upload', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const version = (req.query.version || '1.0.1').trim();

  try {
    if (!GITHUB_TOKEN || GITHUB_TOKEN.includes('your_token_here')) {
      throw new Error('GITHUB_TOKEN is missing or not configured in .env file!');
    }
    // ── 1. Read binary ──
    if (!fs.existsSync(BIN_PATH)) {
      sseLog(res, '❌ firmware.bin not found — build first!', 'error');
      res.write('data: {"type":"done","code":1}\n\n');
      res.end();
      return;
    }

    const binData = fs.readFileSync(BIN_PATH);
    sseLog(res, `📂 Read firmware.bin  (${(binData.length / 1024).toFixed(1)} KB)`);

    // ── 2. Ensure branch exists ──
    sseLog(res, `🌿 Ensuring branch "${GITHUB_BRANCH}" exists on ${GITHUB_REPO}…`);
    const branchUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`;
    const branchCheck = await fetch(branchUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
      }
    });

    if (branchCheck.status === 404) {
      // Create branch from HEAD of default branch
      sseLog(res, `🌿 Branch not found — creating from main…`);
      const defRef = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
      );
      const defData = await defRef.json();
      const sha = defData?.object?.sha;
      if (!sha) throw new Error('Could not get SHA of main branch');

      const createBranch = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/git/refs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ref: `refs/heads/${GITHUB_BRANCH}`, sha })
        }
      );
      if (!createBranch.ok) throw new Error(`Branch create failed: ${await createBranch.text()}`);
      sseLog(res, `✅ Branch "${GITHUB_BRANCH}" created`, 'success');
    } else {
      sseLog(res, `✅ Branch "${GITHUB_BRANCH}" exists`);
    }

    // ── 3. Upload firmware.bin ──
    sseLog(res, `⬆️  Uploading firmware.bin to GitHub…`);
    await ghPutFile(
      'firmware.bin',
      binData,
      `OTA: firmware v${version}`
    );
    sseLog(res, `✅ firmware.bin uploaded`, 'success');

    // ── 4. Upload version.json ──
    const fwUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/firmware.bin`;
    const versionJson = JSON.stringify({ version, firmware_url: fwUrl }, null, 2);
    sseLog(res, `📝 Uploading version.json  (version: ${version})…`);
    await ghPutFile(
      'version.json',
      versionJson,
      `OTA: bump version to ${version}`
    );
    sseLog(res, `✅ version.json uploaded`, 'success');

    sseLog(res,
      `🚀 DONE! Device will update to v${version} on next reboot.`,
      'success'
    );
    res.write('data: {"type":"done","code":0}\n\n');
  } catch (err) {
    sseLog(res, `❌ Upload failed: ${err.message}`, 'error');
    console.error(err);
    res.write('data: {"type":"done","code":1}\n\n');
  }
  res.end();
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌡️  TEMPSENSE Companion running at http://localhost:${PORT}`);
  console.log(`   Repo  : ${GITHUB_REPO}  →  branch: ${GITHUB_BRANCH}`);
  console.log(`   Firmware dir: ${FIRMWARE_DIR}\n`);
  if (!GITHUB_TOKEN || GITHUB_TOKEN.includes('your_token_here')) {
    console.error(`⚠️  WARNING: GITHUB_TOKEN is not configured in your .env file!`);
    console.error(`   Upload functionality will fail.\n`);
  }
});
