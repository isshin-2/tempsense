// TEMPSENSE API Test Suite
// Tests all endpoints systematically

const BASE = 'http://localhost:3001/api';

let adminToken = null;
let siteManagerToken = null;
let customerToken = null;
let createdUserId = null;
let createdSiteId = null;
let createdRoomId = null;

const results = [];

function log(test, pass, detail) {
  const icon = pass ? '✅' : '❌';
  results.push({ test, pass, detail });
  console.log(`${icon} ${test}: ${detail}`);
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: res.status, data: json, ok: res.ok };
  } catch (err) {
    return { status: 0, data: err.message, ok: false };
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('  TEMPSENSE API TEST SUITE');
  console.log('========================================\n');

  // ===== 1. AUTH: Login =====
  console.log('\n--- 1. AUTH: Login ---');
  
  // 1a. Login with system admin
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@maxworthonline.com',
    password: 'TMS@2026'
  });
  log('Login (system admin)', loginRes.ok && loginRes.data.token,
    loginRes.ok ? `Token received, role=${loginRes.data.user.role}` : `FAILED: ${JSON.stringify(loginRes.data)}`);
  adminToken = loginRes.data?.token;

  // 1b. Login with wrong password
  const badLogin = await request('POST', '/auth/login', {
    email: 'admin@maxworthonline.com',
    password: 'wrongpassword'
  });
  log('Login (wrong password)', badLogin.status === 401,
    `Status=${badLogin.status} (expected 401)`);

  // 1c. Login with missing fields
  const noFieldLogin = await request('POST', '/auth/login', { email: '' });
  log('Login (missing fields)', noFieldLogin.status === 400,
    `Status=${noFieldLogin.status} (expected 400)`);

  // ===== 2. AUTH: /me =====
  console.log('\n--- 2. AUTH: /me ---');
  
  const meRes = await request('GET', '/auth/me', null, adminToken);
  log('GET /me (authed)', meRes.ok && meRes.data.user,
    meRes.ok ? `name=${meRes.data.user.name}, role=${meRes.data.user.role}` : `FAILED: ${JSON.stringify(meRes.data)}`);

  const meNoAuth = await request('GET', '/auth/me');
  log('GET /me (no token)', meNoAuth.status === 401,
    `Status=${meNoAuth.status} (expected 401)`);

  // ===== 3. AUTH: Company =====
  console.log('\n--- 3. Company Name ---');
  
  const companyGet = await request('GET', '/auth/company', null, adminToken);
  log('GET /company', companyGet.ok,
    `companyName="${companyGet.data?.companyName || ''}"`);

  const companyPut = await request('PUT', '/auth/company', { companyName: 'Maxworth Techserv Pvt Ltd' }, adminToken);
  log('PUT /company', companyPut.ok,
    companyPut.ok ? `Updated to: ${companyPut.data.companyName}` : `FAILED: ${JSON.stringify(companyPut.data)}`);

  const companyVerify = await request('GET', '/auth/company', null, adminToken);
  log('GET /company (verify)', companyVerify.data?.companyName === 'Maxworth Techserv Pvt Ltd',
    `companyName="${companyVerify.data?.companyName}"`);

  // ===== 4. SITES: CRUD =====
  console.log('\n--- 4. Sites CRUD ---');
  
  const siteCreate = await request('POST', '/sites', {
    name: 'Test Warehouse Alpha',
    location: 'Chennai, TN',
    accountId: 1
  }, adminToken);
  log('POST /sites (create)', siteCreate.ok || siteCreate.status === 201,
    siteCreate.ok ? `id=${siteCreate.data.id || siteCreate.data?.site?.id}` : `FAILED: ${JSON.stringify(siteCreate.data)}`);
  createdSiteId = siteCreate.data?.id || siteCreate.data?.site?.id;

  const sitesList = await request('GET', '/sites', null, adminToken);
  log('GET /sites (list)', sitesList.ok && Array.isArray(sitesList.data),
    `Count: ${sitesList.data?.length || 0}`);
  if (!createdSiteId && sitesList.data?.length > 0) {
    createdSiteId = sitesList.data[0].id;
  }

  if (createdSiteId) {
    const siteUpdate = await request('PUT', `/sites/${createdSiteId}`, {
      name: 'Test Warehouse Alpha (Updated)',
      location: 'Chennai, Tamil Nadu'
    }, adminToken);
    log('PUT /sites/:id (update)', siteUpdate.ok,
      siteUpdate.ok ? 'Updated successfully' : `FAILED: ${JSON.stringify(siteUpdate.data)}`);
  }

  // ===== 5. ROOMS: CRUD =====
  console.log('\n--- 5. Rooms CRUD ---');
  
  if (createdSiteId) {
    const roomCreate = await request('POST', '/rooms', {
      name: 'Test Cold Room 1',
      siteId: createdSiteId
    }, adminToken);
    log('POST /rooms (create)', roomCreate.ok || roomCreate.status === 201,
      roomCreate.ok ? `id=${roomCreate.data.id || roomCreate.data?.room?.id}` : `FAILED: ${JSON.stringify(roomCreate.data)}`);
    createdRoomId = roomCreate.data?.id || roomCreate.data?.room?.id;
  }

  const roomsList = await request('GET', '/rooms', null, adminToken);
  log('GET /rooms (list)', roomsList.ok && Array.isArray(roomsList.data),
    `Count: ${roomsList.data?.length || 0}`);
  if (!createdRoomId && roomsList.data?.length > 0) {
    createdRoomId = roomsList.data[0].id;
  }

  if (createdRoomId) {
    const roomUpdate = await request('PUT', `/rooms/${createdRoomId}`, {
      name: 'Test Cold Room 1 (Updated)'
    }, adminToken);
    log('PUT /rooms/:id (update)', roomUpdate.ok,
      roomUpdate.ok ? 'Updated successfully' : `FAILED: ${JSON.stringify(roomUpdate.data)}`);
  }

  // ===== 6. NODES: List =====
  console.log('\n--- 6. Nodes ---');
  
  const nodesList = await request('GET', '/nodes', null, adminToken);
  log('GET /nodes (list)', nodesList.ok && Array.isArray(nodesList.data),
    `Count: ${nodesList.data?.length || 0}`);

  // ===== 7. USER MANAGEMENT =====
  console.log('\n--- 7. User Management ---');
  
  // 7a. Register a site_manager
  const regSM = await request('POST', '/auth/register', {
    name: 'Test Site Manager',
    email: 'test_sm_' + Date.now() + '@test.com',
    password: 'Test@123',
    role: 'site_manager',
    siteIds: createdSiteId ? [createdSiteId] : []
  }, adminToken);
  log('Register site_manager', regSM.ok || regSM.status === 201,
    regSM.ok ? `id=${regSM.data.user?.id}, role=${regSM.data.user?.role}` : `FAILED: ${JSON.stringify(regSM.data)}`);
  const smId = regSM.data?.user?.id;
  const smEmail = regSM.data?.user?.email;

  // 7b. Register a customer
  const regCust = await request('POST', '/auth/register', {
    name: 'Test Customer',
    email: 'test_cust_' + Date.now() + '@test.com',
    password: 'Test@123',
    role: 'customer',
    roomIds: createdRoomId ? [createdRoomId] : []
  }, adminToken);
  log('Register customer', regCust.ok || regCust.status === 201,
    regCust.ok ? `id=${regCust.data.user?.id}, role=${regCust.data.user?.role}` : `FAILED: ${JSON.stringify(regCust.data)}`);
  const custId = regCust.data?.user?.id;
  const custEmail = regCust.data?.user?.email;

  // 7c. List users
  const usersList = await request('GET', '/auth/users', null, adminToken);
  log('GET /users (list)', usersList.ok && Array.isArray(usersList.data),
    `Count: ${usersList.data?.length || 0}, hidden super_admin excluded: ${!usersList.data?.find(u => u.is_hidden_super_admin)}`);

  // 7d. Edit user
  if (smId) {
    const editUser = await request('PUT', `/auth/users/${smId}`, {
      name: 'Test SM Updated',
      phone: '9876543210',
      role: 'site_manager',
      siteIds: createdSiteId ? [createdSiteId] : []
    }, adminToken);
    log('PUT /users/:id (edit)', editUser.ok,
      editUser.ok ? `Updated: name=${editUser.data.user?.name}` : `FAILED: ${JSON.stringify(editUser.data)}`);
  }

  // 7e. Change role
  if (custId) {
    const roleChange = await request('PUT', `/auth/users/${custId}/role`, {
      role: 'site_manager'
    }, adminToken);
    log('PUT /users/:id/role', roleChange.ok,
      roleChange.ok ? `New role: ${roleChange.data.user?.role}` : `FAILED: ${JSON.stringify(roleChange.data)}`);

    // Change back
    await request('PUT', `/auth/users/${custId}/role`, { role: 'customer' }, adminToken);
  }

  // 7f. Invalid role
  if (custId) {
    const badRole = await request('PUT', `/auth/users/${custId}/role`, {
      role: 'super_admin'
    }, adminToken);
    log('PUT /users/:id/role (invalid)', badRole.status === 400,
      `Status=${badRole.status} (expected 400)`);
  }

  // 7g. Duplicate email
  if (smEmail) {
    const dupReg = await request('POST', '/auth/register', {
      name: 'Duplicate',
      email: smEmail,
      password: 'Test@123',
      role: 'customer'
    }, adminToken);
    log('Register (duplicate email)', dupReg.status === 409,
      `Status=${dupReg.status} (expected 409)`);
  }

  // ===== 8. RBAC: Site Manager Login & Access =====
  console.log('\n--- 8. RBAC: Site Manager ---');
  
  if (smEmail) {
    const smLogin = await request('POST', '/auth/login', {
      email: smEmail,
      password: 'Test@123'
    });
    log('Site Manager login', smLogin.ok,
      smLogin.ok ? `role=${smLogin.data.user?.role}` : `FAILED: ${JSON.stringify(smLogin.data)}`);
    siteManagerToken = smLogin.data?.token;

    if (siteManagerToken) {
      const smSites = await request('GET', '/sites', null, siteManagerToken);
      log('SM: GET /sites (filtered)', smSites.ok,
        `Sites visible: ${smSites.data?.length || 0}`);

      const smRooms = await request('GET', '/rooms', null, siteManagerToken);
      log('SM: GET /rooms (filtered)', smRooms.ok,
        `Rooms visible: ${smRooms.data?.length || 0}`);

      const smNodes = await request('GET', '/nodes', null, siteManagerToken);
      log('SM: GET /nodes (filtered)', smNodes.ok,
        `Nodes visible: ${smNodes.data?.length || 0}`);

      // SM should NOT be able to access user management
      const smUsers = await request('GET', '/auth/users', null, siteManagerToken);
      log('SM: GET /users (forbidden)', smUsers.status === 403,
        `Status=${smUsers.status} (expected 403)`);
    }
  }

  // ===== 9. RBAC: Customer Login & Access =====
  console.log('\n--- 9. RBAC: Customer ---');
  
  if (custEmail) {
    const custLogin = await request('POST', '/auth/login', {
      email: custEmail,
      password: 'Test@123'
    });
    log('Customer login', custLogin.ok,
      custLogin.ok ? `role=${custLogin.data.user?.role}` : `FAILED: ${JSON.stringify(custLogin.data)}`);
    customerToken = custLogin.data?.token;

    if (customerToken) {
      const custRooms = await request('GET', '/rooms', null, customerToken);
      log('Customer: GET /rooms (room-filtered)', custRooms.ok,
        `Rooms visible: ${custRooms.data?.length || 0}`);

      const custNodes = await request('GET', '/nodes', null, customerToken);
      log('Customer: GET /nodes (room-filtered)', custNodes.ok,
        `Nodes visible: ${custNodes.data?.length || 0}`);

      // Customer should NOT access user management
      const custUsers = await request('GET', '/auth/users', null, customerToken);
      log('Customer: GET /users (forbidden)', custUsers.status === 403,
        `Status=${custUsers.status} (expected 403)`);

      // Customer should NOT create sites
      const custCreateSite = await request('POST', '/sites', { name: 'Hack', location: 'x', accountId: 1 }, customerToken);
      log('Customer: POST /sites (forbidden)', custCreateSite.status === 403,
        `Status=${custCreateSite.status} (expected 403)`);
    }
  }

  // ===== 10. DATA: Latest + Exports =====
  console.log('\n--- 10. Data & Exports ---');
  
  const latestData = await request('GET', '/data/latest', null, adminToken);
  log('GET /data/latest', latestData.ok,
    `Nodes with data: ${latestData.data?.length || 0}`);

  // Test export with auth header
  const csvExport = await fetch(`${BASE}/data/export/csv?range=24h`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  log('GET /data/export/csv (header auth)', csvExport.ok || csvExport.status === 200,
    `Status=${csvExport.status}`);

  // Test export with query token (fallback)
  const csvExportQ = await fetch(`${BASE}/data/export/csv?range=24h&token=${adminToken}`);
  log('GET /data/export/csv (query token)', csvExportQ.ok || csvExportQ.status === 200,
    `Status=${csvExportQ.status}`);

  // ===== 11. SETTINGS =====
  console.log('\n--- 11. Settings ---');
  
  const settings = await request('GET', '/settings', null, adminToken);
  log('GET /settings', settings.ok,
    settings.ok ? `Keys: ${Object.keys(settings.data).join(', ')}` : `FAILED: ${JSON.stringify(settings.data)}`);

  // ===== 12. ALERTS =====
  console.log('\n--- 12. Alerts ---');
  
  const alerts = await request('GET', '/alerts', null, adminToken);
  log('GET /alerts', alerts.ok,
    `Alerts count: ${Array.isArray(alerts.data) ? alerts.data.length : 'N/A'}`);

  // ===== 13. SYSTEM ADMIN PROTECTION =====
  console.log('\n--- 13. System Admin Protection ---');
  
  // Find system admin ID from the user list perspective (shouldn't appear)
  const usersCheck = await request('GET', '/auth/users', null, adminToken);
  const hiddenExists = usersCheck.data?.find(u => u.email === 'admin@maxworthonline.com');
  log('System admin hidden from user list', !hiddenExists,
    hiddenExists ? 'EXPOSED in list!' : 'Correctly hidden');

  // Login response should show role=admin (not super_admin)
  log('System admin role masked', loginRes.data?.user?.role === 'admin',
    `Visible role: ${loginRes.data?.user?.role} (should be "admin", not "super_admin")`);

  // ===== 14. CLEANUP =====
  console.log('\n--- 14. Cleanup ---');
  
  if (custId) {
    const delCust = await request('DELETE', `/auth/users/${custId}`, null, adminToken);
    log('Delete test customer', delCust.ok,
      delCust.ok ? 'Deleted' : `FAILED: ${JSON.stringify(delCust.data)}`);
  }

  if (smId) {
    const delSM = await request('DELETE', `/auth/users/${smId}`, null, adminToken);
    log('Delete test site_manager', delSM.ok,
      delSM.ok ? 'Deleted' : `FAILED: ${JSON.stringify(delSM.data)}`);
  }

  if (createdRoomId) {
    const delRoom = await request('DELETE', `/rooms/${createdRoomId}`, null, adminToken);
    log('Delete test room', delRoom.ok,
      delRoom.ok ? 'Deleted' : `FAILED: ${JSON.stringify(delRoom.data)}`);
  }

  if (createdSiteId) {
    const delSite = await request('DELETE', `/sites/${createdSiteId}`, null, adminToken);
    log('Delete test site', delSite.ok,
      delSite.ok ? 'Deleted' : `FAILED: ${JSON.stringify(delSite.data)}`);
  }

  // ===== SUMMARY =====
  console.log('\n========================================');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
    console.log('');
  }
}

runTests().catch(err => console.error('Test suite error:', err));
