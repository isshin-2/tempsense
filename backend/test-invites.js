/**
 * TEMPSENSE Email-Based User Invitation Test Suite
 */

const BASE = 'http://localhost:3001/api';
let adminToken = null;
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
  console.log('\n' + '='.repeat(56));
  console.log('  TEMPSENSE USER INVITATIONS TEST SUITE');
  console.log('='.repeat(56) + '\n');

  // 1. Authenticate as Admin
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@maxworthonline.com', password: 'TMS@2026'
  });
  if (!loginRes.ok) {
    console.error('❌ Cannot login as admin — aborting tests');
    return;
  }
  adminToken = loginRes.data.token;
  log('Admin Login', true, 'Authenticated successfully');

  // Generate test email
  const testEmail = `invited_user_${Date.now()}@test.com`;
  let invitedUserId = null;
  let inviteToken = null;

  // 2. Register User (Passwordless Invite)
  console.log('\n--- 1. Send Invitation (POST /auth/register without password) ---');
  const inviteRes = await request('POST', '/auth/register', {
    email: testEmail,
    name: 'Test Invited User',
    role: 'customer',
    siteIds: [],
    roomIds: []
  }, adminToken);

  log('Invite response status', inviteRes.status === 201, `Status: ${inviteRes.status}`);
  if (inviteRes.ok) {
    invitedUserId = inviteRes.data.user.id;
    inviteToken = inviteRes.data.inviteToken;
    log('Invite returns user details', !!invitedUserId && inviteRes.data.user.email === testEmail.toLowerCase(), `Email: ${inviteRes.data.user.email}, ID: ${invitedUserId}`);
    log('Invite returns inviteToken', !!inviteToken, `Token: ${inviteToken}`);
    log('Invite reports email status', 'emailSent' in inviteRes.data, `Email Sent: ${inviteRes.data.emailSent}`);
  } else {
    console.error('❌ Invite failed:', inviteRes.data);
    return;
  }

  // 3. Validate Token
  console.log('\n--- 2. Validate Invitation Token (GET /auth/invite/validate) ---');
  const validateRes = await request('GET', `/auth/invite/validate?token=${inviteToken}`);
  log('Validate response status', validateRes.ok, `Status: ${validateRes.status}`);
  if (validateRes.ok) {
    log('Validate returns name', validateRes.data.name === 'Test Invited User', `Name: ${validateRes.data.name}`);
    log('Validate returns email', validateRes.data.email === testEmail.toLowerCase(), `Email: ${validateRes.data.email}`);
    log('Validate returns role', validateRes.data.role === 'customer', `Role: ${validateRes.data.role}`);
  }

  // 3b. Validate Invalid Token
  const badValidateRes = await request('GET', `/auth/invite/validate?token=non_existent_token_123`);
  log('Validate bad token is blocked', badValidateRes.status === 400, `Status: ${badValidateRes.status} (expected 400)`);

  // 4. Accept Invitation (Set Password)
  console.log('\n--- 3. Accept Invitation & Set Password (POST /auth/invite/accept) ---');
  const acceptRes = await request('POST', '/auth/invite/accept', {
    token: inviteToken,
    password: 'NewPassword@123'
  });
  log('Accept invite status', acceptRes.ok, `Status: ${acceptRes.status}`);
  if (acceptRes.ok) {
    log('Accept invite returns login JWT', !!acceptRes.data.token, 'JWT token returned');
    log('Accept invite completes profile', acceptRes.data.user.profileCompleted === true, `profileCompleted: ${acceptRes.data.user.profileCompleted}`);
  }

  // 4b. Verify token is deleted (validate again)
  const reValidateRes = await request('GET', `/auth/invite/validate?token=${inviteToken}`);
  log('Used token is now invalid', reValidateRes.status === 400, `Status: ${reValidateRes.status} (expected 400)`);

  // 5. Test Login with New Password
  console.log('\n--- 4. Log in with New Password ---');
  const newLoginRes = await request('POST', '/auth/login', {
    email: testEmail,
    password: 'NewPassword@123'
  });
  log('Login with new password', newLoginRes.ok, `Status: ${newLoginRes.status}`);
  if (newLoginRes.ok) {
    log('Login returns correct user', newLoginRes.data.user.email === testEmail.toLowerCase(), `Email: ${newLoginRes.data.user.email}`);
  }

  // 6. Cleanup
  console.log('\n--- Cleanup ---');
  if (invitedUserId) {
    const deleteRes = await request('DELETE', `/auth/users/${invitedUserId}`, null, adminToken);
    log('Delete test user', deleteRes.ok, `Deleted user ID ${invitedUserId}`);
  }

  // Summary
  console.log('\n' + '='.repeat(56));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(56) + '\n');

  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
