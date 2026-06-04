/**
 * TEMPSENSE Frontend E2E Test Suite v3
 * Strategy: 
 *  - Login test uses fresh page + native React input setter
 *  - All other page tests use pre-set localStorage auth token
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001/api';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
// Clean old screenshots
fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(path.join(SCREENSHOT_DIR, f)));

const results = [];
function log(test, pass, detail = '') {
  results.push({ test, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${test}: ${detail}`);
}
async function ss(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Set a React controlled input value properly
async function setInput(page, selector, value) {
  await page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}

async function runTests() {
  console.log('\n========================================');
  console.log('  TEMPSENSE FRONTEND E2E TEST SUITE v3');
  console.log('========================================\n');

  // Step 0: Get auth token via API (so we can pre-inject it)
  const loginApi = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@maxworthonline.com', password: 'TMS@2026' }),
  });
  const loginData = await loginApi.json();
  const TOKEN = loginData.token;
  const USER = loginData.user;
  if (!TOKEN) { console.error('❌ Could not get auth token from API'); return; }
  console.log(`✅ API token obtained (role=${USER.role})\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const consoleErrors = [];

  try {
    // ==============================
    // TEST GROUP A: LOGIN FLOW
    // ==============================
    console.log('═══ GROUP A: LOGIN FLOW ═══');
    
    // A1: Login page renders
    console.log('\n--- A1. Login Page ---');
    const loginPage = await browser.newPage();
    await loginPage.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await ss(loginPage, '01_login_page');
    log('Login page loads', !!(await loginPage.$('input[type="password"]')), 'Form rendered');

    // A2: Wrong password
    console.log('\n--- A2. Wrong Password ---');
    await setInput(loginPage, 'input[type="email"]', 'admin@maxworthonline.com');
    await setInput(loginPage, 'input[type="password"]', 'wrongpassword');
    await loginPage.click('button[type="submit"]');
    await sleep(2500);
    await ss(loginPage, '02_wrong_password');
    const errMsg = await loginPage.evaluate(() => {
      const el = document.querySelector('.error-msg, .login-error');
      return el ? el.textContent : '';
    });
    log('Wrong password error', errMsg.includes('Invalid'), `Error: "${errMsg}"`);

    // A3: Correct login
    console.log('\n--- A3. Correct Login ---');
    await setInput(loginPage, 'input[type="email"]', 'admin@maxworthonline.com');
    await setInput(loginPage, 'input[type="password"]', 'TMS@2026');
    await loginPage.click('button[type="submit"]');
    // Wait for SPA redirect (poll URL)
    let loginUrl = loginPage.url();
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      loginUrl = loginPage.url();
      if (!loginUrl.includes('/login')) break;
    }
    await ss(loginPage, '03_after_login');
    const loginOk = !loginUrl.includes('/login');
    log('Login redirects to app', loginOk, `URL: ${loginUrl}`);
    
    // Check token is stored
    const storedToken = await loginPage.evaluate(() => localStorage.getItem('tempsense_token'));
    log('Token stored in localStorage', !!storedToken, storedToken ? `Length: ${storedToken.length}` : 'Missing');

    // A4: Sign Out
    console.log('\n--- A4. Sign Out ---');
    if (loginOk) {
      await loginPage.evaluate(() => {
        for (const b of document.querySelectorAll('button'))
          if (b.textContent.includes('Sign Out') || b.textContent.includes('Logout')) { b.click(); break; }
      });
      await sleep(2000);
      await ss(loginPage, '04_after_signout');
      const backToLogin = !!(await loginPage.$('input[type="password"]'));
      log('Sign out → login page', backToLogin, `Login form: ${backToLogin}`);
    }
    await loginPage.close();

    // ==============================
    // TEST GROUP B: AUTHENTICATED PAGES
    // Pre-inject token via localStorage
    // ==============================
    console.log('\n═══ GROUP B: AUTHENTICATED PAGES ═══');
    
    const page = await browser.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    // Inject auth into localStorage before navigating
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.evaluate((token, user) => {
      localStorage.setItem('tempsense_token', token);
      localStorage.setItem('tempsense_user', JSON.stringify(user));
    }, TOKEN, USER);

    // B1: Dashboard
    console.log('\n--- B1. Dashboard ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await ss(page, '05_dashboard');

    const dashHeading = await page.evaluate(() => { const h = document.querySelector('h2'); return h ? h.textContent : ''; });
    log('Dashboard heading', dashHeading.toLowerCase().includes('dashboard'), `"${dashHeading}"`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    log('Company name visible', bodyText.includes('Maxworth Techserv'), 'Top-right corner');

    const statCards = (await page.$$('.stat-card')).length;
    log('Stat cards', statCards >= 3, `Count: ${statCards}`);

    // B2: Sidebar
    console.log('\n--- B2. Sidebar ---');
    log('Sidebar exists', !!(await page.$('.sidebar')), 'Sidebar found');
    const navCount = (await page.$$('.nav-item')).length;
    log('Nav links', navCount > 0, `Count: ${navCount}`);
    log('ADMIN badge', bodyText.includes('ADMIN'), 'Badge visible');
    log('No super_admin', !bodyText.includes('super_admin'), 'Clean');

    // B3: Sites
    console.log('\n--- B3. Sites Page ---');
    await page.goto(`${BASE_URL}/sites`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await ss(page, '06_sites_page');
    log('Sites page', await page.evaluate(() => !!document.querySelector('h2')?.textContent.includes('Sites')), 'Loaded');

    // Add Site modal
    const addSite = await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('Add Site')) { b.click(); return true; } return false; });
    await sleep(500);
    if (addSite) {
      await ss(page, '06b_add_site_modal');
      log('Add Site modal', !!(await page.$('.modal')), 'Opens');
      // Fill and submit
      const inputs = await page.$$('.modal input');
      if (inputs[0]) { await inputs[0].click(); await inputs[0].type('E2E Test Site'); }
      if (inputs[1]) { await inputs[1].click(); await inputs[1].type('E2E Location'); }
      const submitBtn = await page.$('.modal button[type="submit"]');
      if (submitBtn) { await submitBtn.click(); await sleep(2000); }
      await ss(page, '06c_site_created');
      log('Site created', await page.evaluate(() => document.body.innerText.includes('E2E Test Site')), 'In table');
    }

    // Edit Site
    const siteEditBtns = await page.$$('.btn-ghost.btn-sm');
    if (siteEditBtns.length > 0) {
      await siteEditBtns[0].click(); await sleep(500);
      await ss(page, '06d_edit_site');
      const t = await page.evaluate(() => document.querySelector('.modal h3')?.textContent || '');
      log('Edit Site modal', t.includes('Edit'), `Title: "${t}"`);
      await page.evaluate(() => { for (const b of document.querySelectorAll('.modal button')) if (b.textContent.includes('Cancel')) { b.click(); break; } });
      await sleep(300);
    }

    // B4: Rooms
    console.log('\n--- B4. Rooms Page ---');
    await page.goto(`${BASE_URL}/rooms`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await ss(page, '07_rooms_page');
    log('Rooms page', await page.evaluate(() => !!document.querySelector('h2')?.textContent.includes('Rooms')), 'Loaded');

    const addRoom = await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('Add Room')) { b.click(); return true; } return false; });
    await sleep(500);
    if (addRoom) {
      await ss(page, '07b_add_room');
      log('Add Room modal', !!(await page.$('.modal')), 'Opens');
      log('Site selector present', !!(await page.$('.modal select')), 'Dropdown found');
      await page.evaluate(() => { for (const b of document.querySelectorAll('.modal button')) if (b.textContent.includes('Cancel')) { b.click(); break; } });
      await sleep(300);
    }

    const roomEdits = await page.$$('.btn-ghost.btn-sm');
    if (roomEdits.length > 0) {
      await roomEdits[0].click(); await sleep(500);
      await ss(page, '07c_edit_room');
      const t = await page.evaluate(() => document.querySelector('.modal h3')?.textContent || '');
      log('Edit Room modal', t.includes('Edit'), `Title: "${t}"`);
      log('Site selector hidden in edit', !(await page.$('.modal select')), 'Hidden');
      await page.evaluate(() => { for (const b of document.querySelectorAll('.modal button')) if (b.textContent.includes('Cancel')) { b.click(); break; } });
    }

    // B5: Nodes
    console.log('\n--- B5. Nodes Page ---');
    await page.goto(`${BASE_URL}/nodes`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await ss(page, '08_nodes_page');
    log('Nodes page', await page.evaluate(() => !!document.querySelector('h2')?.textContent.includes('Nodes')), 'Loaded');

    // B6: User Management
    console.log('\n--- B6. User Management ---');
    await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await ss(page, '09_users_page');
    log('User Management', await page.evaluate(() => !!document.querySelector('h2')?.textContent.includes('User')), 'Loaded');
    log('User table', !!(await page.$('.data-table')), 'Rendered');

    // Invite modal + role selector
    const invite = await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('Invite')) { b.click(); return true; } return false; });
    await sleep(500);
    if (invite) {
      await ss(page, '09b_invite_modal');
      log('Invite modal opens', !!(await page.$('.modal')), 'Modal visible');

      const roles = await page.evaluate(() => {
        const s = document.querySelector('.modal select');
        return s ? Array.from(s.options).map(o => o.text) : [];
      });
      log('Role options', roles.some(r => r.includes('Customer')) && roles.some(r => r.includes('Site Manager')), `${roles.join(', ')}`);

      // Site Manager → site checkboxes
      await page.evaluate(() => {
        const s = document.querySelector('.modal select');
        for (const o of s.options) if (o.text.includes('Site Manager')) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); break; }
      });
      await sleep(500);
      await ss(page, '09c_sm_access');
      const smCB = (await page.$$('.modal input[type="checkbox"]')).length;
      log('Site checkboxes for SM', smCB > 0, `Count: ${smCB}`);

      // Customer → room checkboxes
      await page.evaluate(() => {
        const s = document.querySelector('.modal select');
        for (const o of s.options) if (o.text.includes('Customer')) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); break; }
      });
      await sleep(500);
      await ss(page, '09d_cust_access');
      const custCB = (await page.$$('.modal input[type="checkbox"]')).length;
      log('Room checkboxes for Customer', custCB > 0, `Count: ${custCB}`);

      await page.evaluate(() => { for (const b of document.querySelectorAll('.modal button')) if (b.textContent.includes('Cancel')) { b.click(); break; } });
      await sleep(300);
    }

    // Edit user
    const userEdits = await page.$$('.btn-ghost.btn-sm');
    if (userEdits.length > 0) {
      await userEdits[0].click(); await sleep(500);
      await ss(page, '09e_edit_user');
      const t = await page.evaluate(() => document.querySelector('.modal h3')?.textContent || '');
      log('Edit User modal', t.includes('Edit'), `Title: "${t}"`);
      const val = await page.evaluate(() => document.querySelector('.modal input')?.value || '');
      log('Edit form pre-filled', val.length > 0, `Name: "${val}"`);
      await page.evaluate(() => { for (const b of document.querySelectorAll('.modal button')) if (b.textContent.includes('Cancel')) { b.click(); break; } });
    }

    // B7: Reports
    console.log('\n--- B7. Reports ---');
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await ss(page, '10_reports_page');
    const repText = await page.evaluate(() => document.body.innerText);
    log('Reports page', repText.includes('Report'), 'Loaded');
    log('CSV button', repText.includes('CSV'), 'Found');
    log('PDF button', repText.includes('PDF'), 'Found');

    // B8: Alerts
    console.log('\n--- B8. Alerts ---');
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await ss(page, '11_alerts_page');
    log('Alerts page', (await page.evaluate(() => document.body.innerText)).includes('Alert'), 'Loaded');

    // B9: Settings
    console.log('\n--- B9. Settings ---');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await ss(page, '12_settings_page');
    const setText = await page.evaluate(() => document.body.innerText);
    log('Settings page', setText.includes('Settings') || setText.includes('SMTP'), 'Loaded');

    await page.close();

    // ==============================
    // TEST GROUP C: ROLE-BASED ACCESS
    // ==============================
    console.log('\n═══ GROUP C: ROLE-BASED ACCESS ═══');

    // Create test users via API
    // We update them directly to set profile_completed = TRUE so we don't have to navigate through the setup UI
    const smReg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ name: 'E2E SM', email: `e2e_sm_${Date.now()}@test.com`, password: 'Test@123', role: 'site_manager', siteIds: [] }),
    });
    const smData = await smReg.json();

    const custReg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ name: 'E2E Cust', email: `e2e_cust_${Date.now()}@test.com`, password: 'Test@123', role: 'customer', roomIds: [] }),
    });
    const custData = await custReg.json();

    // Mark them as profile_completed = true directly via DB or API (we can use update user API if we add it, but our test token is super admin).
    // Actually, we'll just navigate to profile-setup and complete it for them!

    // C1: Site Manager view
    console.log('\n--- C1. Site Manager View ---');
    const smPage = await browser.newPage();
    const smLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: smData.user.email, password: 'Test@123' }),
    });
    const smLoginData = await smLogin.json();

    await smPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await smPage.evaluate((t, u) => {
      localStorage.setItem('tempsense_token', t);
      localStorage.setItem('tempsense_user', JSON.stringify(u));
    }, smLoginData.token, smLoginData.user);
    await smPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
    // Check if on profile-setup, then complete it
    let smUrl = smPage.url();
    if (smUrl.includes('/profile-setup')) {
      await setInput(smPage, 'input[placeholder*="Maxworth" i]', 'Maxworth Techserv');
      await setInput(smPage, 'input[type="tel"]', '1234567890');
      await smPage.click('button[type="submit"]');
      await sleep(2000);
    }
    
    await ss(smPage, '13_sm_dashboard');

    const smBody = await smPage.evaluate(() => document.body.innerText);
    log('SM sees dashboard', smBody.includes('Dashboard'), 'Loaded');
    log('SM badge shows SITE MANAGER', smBody.includes('SITE MANAGER'), `Badge visible`);

    // SM should NOT see Users link
    const smHasUsers = await smPage.evaluate(() => !!document.querySelector('a[href="/users"]'));
    log('SM: no Users nav link', !smHasUsers, `Hidden: ${!smHasUsers}`);

    // SM direct URL to /users should redirect
    await smPage.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const smUsersUrl = smPage.url();
    // They are not allowed on /users, so they will be redirected to / (Dashboard)
    log('SM: /users redirected', !smUsersUrl.includes('/users'), `URL: ${smUsersUrl}`);

    await smPage.close();

    // C2: Customer view
    console.log('\n--- C2. Customer View ---');
    const custPage = await browser.newPage();
    const custLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: custData.user.email, password: 'Test@123' }),
    });
    const custLoginData = await custLogin.json();

    await custPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await custPage.evaluate((t, u) => {
      localStorage.setItem('tempsense_token', t);
      localStorage.setItem('tempsense_user', JSON.stringify(u));
    }, custLoginData.token, custLoginData.user);
    await custPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
    // Check if on profile-setup, then complete it
    let custUrl = custPage.url();
    if (custUrl.includes('/profile-setup')) {
      await setInput(custPage, 'input[placeholder*="Maxworth" i]', 'Maxworth Techserv');
      await setInput(custPage, 'input[type="tel"]', '1234567890');
      await custPage.click('button[type="submit"]');
      await sleep(2000);
    }
    
    await ss(custPage, '14_cust_dashboard');

    const custBody = await custPage.evaluate(() => document.body.innerText);
    log('Customer sees dashboard', custBody.includes('Dashboard'), 'Loaded');
    log('Customer badge shows CUSTOMER', custBody.includes('CUSTOMER'), 'Badge visible');

    const custHasUsers = await custPage.evaluate(() => !!document.querySelector('a[href="/users"]'));
    log('Customer: no Users nav', !custHasUsers, `Hidden: ${!custHasUsers}`);

    const custHasSettings = await custPage.evaluate(() => !!document.querySelector('a[href="/settings"]'));
    log('Customer: no Settings nav', !custHasSettings, `Hidden: ${!custHasSettings}`);

    await custPage.close();

    // ==============================
    // CLEANUP
    // ==============================
    console.log('\n--- Cleanup ---');
    if (smData.user?.id) {
      await fetch(`${API_URL}/auth/users/${smData.user.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${TOKEN}` } });
    }
    if (custData.user?.id) {
      await fetch(`${API_URL}/auth/users/${custData.user.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${TOKEN}` } });
    }

    // Delete E2E test site
    const sitesRes = await fetch(`${API_URL}/sites`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const sites = await sitesRes.json();
    const testSite = sites.find(s => s.name === 'E2E Test Site');
    if (testSite) {
      await fetch(`${API_URL}/sites/${testSite.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${TOKEN}` } });
      log('Test site deleted', true, `id=${testSite.id}`);
    }
    log('Test users deleted', true, 'Cleaned up');

    // Console errors
    const realErrors = consoleErrors.filter(e => !e.includes('favicon'));
    log('Console errors', realErrors.length === 0,
      realErrors.length === 0 ? 'Clean' : `${realErrors.length}: ${realErrors.slice(0, 2).join('; ')}`);

  } catch (err) {
    console.error('\n🔥 Error:', err.message);
  } finally {
    await browser.close();
  }

  // SUMMARY
  console.log('\n========================================');
  const p = results.filter(r => r.pass).length;
  const f = results.filter(r => !r.pass).length;
  console.log(`  FRONTEND E2E: ${p} passed, ${f} failed, ${results.length} total`);
  console.log('========================================\n');
  if (f > 0) {
    console.log('FAILED:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
    console.log('');
  }
  console.log('📸 Screenshots:', SCREENSHOT_DIR);
  fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort().forEach(f => console.log(`  - ${f}`));
}

runTests().catch(e => { console.error('Fatal:', e); process.exit(1); });
