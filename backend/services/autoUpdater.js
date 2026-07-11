const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const pool = require('../db/pool');

const execPromise = util.promisify(exec);

// Path to project root (since server runs in backend/)
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const BACKEND_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

let isUpdating = false;
let updateTimer = null;

/**
 * Run a command in the project root CWD
 */
async function runGitCommand(cmd) {
  try {
    const { stdout, stderr } = await execPromise(cmd, { cwd: PROJECT_ROOT, env: { ...process.env } });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if Git is installed and if it is a git repository
 */
async function isGitAvailable() {
  try {
    const gitCheck = await runGitCommand('git rev-parse --is-inside-work-tree');
    if (gitCheck.success && gitCheck.stdout === 'true') {
      await runGitCommand('git config core.autocrlf false');
      await runGitCommand('git config core.filemode false');
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Parse package.json dependencies
 */
function getDependencies(pkgPath) {
  try {
    if (fs.existsSync(pkgPath)) {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return {
        dependencies: data.dependencies || {},
        devDependencies: data.devDependencies || {}
      };
    }
  } catch (e) {
    console.error(`[Updater] Error reading package.json at ${pkgPath}:`, e.message);
  }
  return { dependencies: {}, devDependencies: {} };
}

/**
 * Check if dependencies changed between old and new config
 */
function hasDependenciesChanged(oldDeps, newDeps) {
  const oldKeys = Object.keys({ ...oldDeps.dependencies, ...oldDeps.devDependencies });
  const newKeys = Object.keys({ ...newDeps.dependencies, ...newDeps.devDependencies });
  
  if (oldKeys.length !== newKeys.length) return true;
  
  for (const k of oldKeys) {
    const oldVal = oldDeps.dependencies[k] || oldDeps.devDependencies[k];
    const newVal = newDeps.dependencies[k] || newDeps.devDependencies[k];
    if (oldVal !== newVal) return true;
  }
  return false;
}

/**
 * Check GitHub for updates
 */
async function checkForUpdates() {
  try {
    const gitAvailable = await isGitAvailable();
    if (!gitAvailable) {
      return { gitAvailable: false, updateAvailable: false, message: 'Git repository not detected' };
    }

    // 1. Fetch latest changes from remote
    console.log('[Updater] Fetching updates from origin...');
    const fetchRes = await runGitCommand('git fetch origin');
    if (!fetchRes.success) {
      return { gitAvailable: true, updateAvailable: false, error: fetchRes.error, message: 'Failed to fetch from GitHub' };
    }

    // 2. Get local HEAD details
    const localHashRes = await runGitCommand('git rev-parse --short HEAD');
    const branchRes = await runGitCommand('git rev-parse --abbrev-ref HEAD');
    
    // 3. Get remote tracking branch details (origin/branch)
    const activeBranch = branchRes.stdout || 'main';
    const remoteHashRes = await runGitCommand(`git rev-parse --short origin/${activeBranch}`);
    
    if (!localHashRes.success || !remoteHashRes.success) {
      return { gitAvailable: true, updateAvailable: false, message: 'Failed to read git branch revisions' };
    }

    const localHash = localHashRes.stdout;
    const remoteHash = remoteHashRes.stdout;
    


    let updateAvailable = false;
    let commits = [];
    let isClean = true;

    // Check if branch is clean
    const statusRes = await runGitCommand('git status --porcelain');
    if (statusRes.success && statusRes.stdout.trim().length > 0) {
      isClean = false;
    }

    if (localHash !== remoteHash) {
      // Find out if origin is ahead
      const baseRes = await runGitCommand(`git merge-base HEAD origin/${activeBranch}`);
      if (baseRes.success) {
        const baseHash = baseRes.stdout.trim();
        const fullLocalHash = (await runGitCommand('git rev-parse HEAD')).stdout.trim();
        
        if (baseHash === fullLocalHash) {
          updateAvailable = true;
          
          // Get commit list between local and remote
          const logRes = await runGitCommand(`git log HEAD..origin/${activeBranch} --oneline --max-count=15`);
          if (logRes.success && logRes.stdout) {
            commits = logRes.stdout.split('\n').map(line => {
              const parts = line.split(' ');
              const hash = parts[0];
              const msg = parts.slice(1).join(' ');
              return { hash, msg };
            });
          }
        }
      }
    }

    // Get current commit message and date
    const commitMsgRes = await runGitCommand('git log -1 --format="%s"');
    const commitDateRes = await runGitCommand('git log -1 --format="%cr"');

    // Update database with latest status
    await pool.query(
      'UPDATE system_settings SET last_update_check = NOW(), update_available = $1 WHERE id = 1',
      [updateAvailable]
    );

    return {
      gitAvailable: true,
      updateAvailable,
      isClean,
      branch: activeBranch,
      currentHash: localHash,
      remoteHash: remoteHash,
      commitMessage: commitMsgRes.success ? commitMsgRes.stdout : '',
      commitDate: commitDateRes.success ? commitDateRes.stdout : '',
      commitsBehind: commits,
      lastCheck: new Date().toISOString()
    };
  } catch (err) {
    console.error('[Updater] Error checking updates:', err.message);
    return { gitAvailable: false, updateAvailable: false, error: err.message };
  }
}

/**
 * Execute git pull, install dependencies, and restart the server
 */
async function installUpdate() {
  if (isUpdating) {
    return { success: false, message: 'Update already in progress' };
  }
  
  isUpdating = true;
  console.log('[Updater] System update process initiated...');

  try {
    const gitAvailable = await isGitAvailable();
    if (!gitAvailable) {
      isUpdating = false;
      throw new Error('Git repository not available');
    }

    const checkRes = await checkForUpdates();
    if (!checkRes.updateAvailable) {
      isUpdating = false;
      return { success: true, message: 'Server is already up to date.' };
    }

    // Read package.json files before pull
    const backendPkgBefore = getDependencies(path.join(BACKEND_DIR, 'package.json'));
    const frontendPkgBefore = getDependencies(path.join(FRONTEND_DIR, 'package.json'));

    // Stash any uncommitted local changes for safety
    if (!checkRes.isClean) {
      console.log('[Updater] Uncommitted changes detected. Running git stash...');
      await runGitCommand('git stash');
    }

    // Pull from remote branch
    console.log(`[Updater] Pulling changes for branch: ${checkRes.branch}...`);
    const pullRes = await runGitCommand(`git pull origin ${checkRes.branch}`);
    if (!pullRes.success) {
      isUpdating = false;
      throw new Error(`Git pull failed: ${pullRes.error || pullRes.stderr}`);
    }
    console.log('[Updater] Git pull completed successfully');

    // Read package.json files after pull
    const backendPkgAfter = getDependencies(path.join(BACKEND_DIR, 'package.json'));
    const frontendPkgAfter = getDependencies(path.join(FRONTEND_DIR, 'package.json'));

    // Check if backend dependencies changed
    let backendInstallNeeded = hasDependenciesChanged(backendPkgBefore, backendPkgAfter);
    if (backendInstallNeeded) {
      console.log('[Updater] Backend dependencies changed. Running npm install...');
      const installRes = await execPromise('npm install', { cwd: BACKEND_DIR });
      console.log('[Updater] Backend npm install finished');
    }

    // Check if frontend dependencies changed
    let frontendInstallNeeded = hasDependenciesChanged(frontendPkgBefore, frontendPkgAfter);
    if (frontendInstallNeeded) {
      console.log('[Updater] Frontend dependencies changed. Running npm install...');
      await execPromise('npm install', { cwd: FRONTEND_DIR });
      console.log('[Updater] Frontend npm install finished');
    }

    console.log('[Updater] Update applied. Restarting server in 1.5 seconds...');
    
    // Schedule restart
    setTimeout(() => {
      console.log('[Updater] Restarting now! (process.exit)');
      process.exit(0);
    }, 1500);

    return {
      success: true,
      message: 'Update pulled successfully. Server is restarting to apply changes...',
      backendInstall: backendInstallNeeded,
      frontendInstall: frontendInstallNeeded
    };

  } catch (err) {
    isUpdating = false;
    console.error('[Updater] Installation failed:', err.message);
    return { success: false, error: err.message, message: 'Update installation failed' };
  }
}

/**
 * Starts background updates check timer
 */
async function startAutoUpdateScheduler() {
  try {
    const settings = await pool.query('SELECT * FROM system_settings LIMIT 1');
    const s = settings.rows[0];
    
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }

    if (s && s.auto_update_enabled) {
      const intervalMs = s.auto_update_interval * 60 * 60 * 1000;
      console.log(`[Updater] Auto updates check enabled. Checking every ${s.auto_update_interval} hour(s)`);
      
      // Perform initial check in background after 5s
      setTimeout(() => {
        checkForUpdates().catch(e => console.error('[Updater] Initial check error:', e.message));
      }, 5000);

      updateTimer = setInterval(() => {
        checkForUpdates().catch(e => console.error('[Updater] Background check error:', e.message));
      }, intervalMs);
    } else {
      console.log('[Updater] Background updates check is currently disabled.');
    }
  } catch (err) {
    console.error('[Updater] Scheduler start error:', err.message);
  }
}

module.exports = {
  checkForUpdates,
  installUpdate,
  startAutoUpdateScheduler,
  isGitAvailable,
  getIsUpdating: () => isUpdating
};
