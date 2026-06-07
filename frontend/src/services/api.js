import { io } from 'socket.io-client';

// Use environment variable if provided (for development), otherwise default to relative path
const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// ===== Auth =====
export function getToken() {
  return localStorage.getItem('tempsense_token');
}

export function getUser() {
  const u = localStorage.getItem('tempsense_user');
  return u ? JSON.parse(u) : null;
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  localStorage.setItem('tempsense_token', data.token);
  localStorage.setItem('tempsense_user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('tempsense_token');
  localStorage.removeItem('tempsense_user');
}

// ===== Sites =====
export async function fetchSites() {
  const res = await fetch(`${API_BASE}/sites`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sites');
  return res.json();
}

export async function createSite(data) {
  const res = await fetch(`${API_BASE}/sites`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create site');
  return res.json();
}

export async function updateSite(id, data) {
  const res = await fetch(`${API_BASE}/sites/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update site');
  return res.json();
}

export async function deleteSite(id) {
  const res = await fetch(`${API_BASE}/sites/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete site');
  return res.json();
}

// ===== Rooms =====
export async function fetchRooms(siteId) {
  const url = siteId ? `${API_BASE}/rooms?siteId=${siteId}` : `${API_BASE}/rooms`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function createRoom(data) {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function deleteRoom(id) {
  const res = await fetch(`${API_BASE}/rooms/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete room');
  return res.json();
}

export async function updateRoom(id, data) {
  const res = await fetch(`${API_BASE}/rooms/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update room');
  return res.json();
}

// ===== Nodes =====
export async function fetchNodes(roomId, siteId) {
  let url = `${API_BASE}/nodes?`;
  if (roomId) url += `roomId=${roomId}&`;
  if (siteId) url += `siteId=${siteId}&`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch nodes');
  return res.json();
}

export async function createNode(data) {
  const res = await fetch(`${API_BASE}/nodes`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create node');
  }
  return res.json();
}

export async function updateNode(id, data) {
  const res = await fetch(`${API_BASE}/nodes/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update node');
  return res.json();
}

export async function deleteNode(id) {
  const res = await fetch(`${API_BASE}/nodes/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete node');
  return res.json();
}

// ===== Data =====
export async function fetchLatest() {
  const res = await fetch(`${API_BASE}/data/latest`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch latest data');
  return res.json();
}

export async function fetchHistory(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/data/history?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchAlerts(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/data/alerts?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function exportCSV(params) {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE}/data/export/csv?${qs}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempsense_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('CSV export failed: ' + err.message);
  }
}

export async function exportPDF(params) {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE}/data/export/pdf?${qs}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempsense_report_${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('PDF export failed: ' + err.message);
  }
}

// ===== Settings & SMTP =====
export async function fetchSMTP() {
  const res = await fetch(`${API_BASE}/settings/smtp`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch SMTP settings');
  return res.json();
}

export async function updateSMTP(data) {
  const res = await fetch(`${API_BASE}/settings/smtp`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update SMTP settings');
  return res.json();
}

export async function testSMTP() {
  const res = await fetch(`${API_BASE}/settings/smtp/test`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'SMTP test failed');
  return data;
}

// ===== Scheduled Reports =====
export async function fetchSchedules() {
  const res = await fetch(`${API_BASE}/settings/reports`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch schedules');
  return res.json();
}

export async function createSchedule(data) {
  const res = await fetch(`${API_BASE}/settings/reports`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create schedule');
  return res.json();
}

export async function updateSchedule(id, data) {
  const res = await fetch(`${API_BASE}/settings/reports/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update schedule');
  return res.json();
}

export async function deleteSchedule(id) {
  const res = await fetch(`${API_BASE}/settings/reports/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete schedule');
  return res.json();
}

export async function testSchedule(id) {
  const res = await fetch(`${API_BASE}/settings/reports/${id}/test`, {
    method: 'POST', headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send test report');
  return data;
}

// ===== User Management =====
export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/auth/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function registerUser(data) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to register user');
  return json;
}

export async function validateInvite(token) {
  const res = await fetch(`${API_BASE}/auth/invite/validate?token=${token}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Invalid or expired invitation link');
  return json;
}

export async function acceptInvite(token, password) {
  const res = await fetch(`${API_BASE}/auth/invite/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to accept invitation');
  return json;
}

export async function updateUserRole(id, role) {
  const res = await fetch(`${API_BASE}/auth/users/${id}/role`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update role');
  return json;
}

export async function deleteUser(id) {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
}

export async function setupProfile(data) {
  const res = await fetch(`${API_BASE}/auth/setup-profile`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Profile setup failed');
  return json;
}

export async function updateUser(id, data) {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update user');
  return json;
}

export async function fetchCompanyName() {
  const res = await fetch(`${API_BASE}/auth/company`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch company name');
  return res.json();
}

export async function updateCompanyName(companyName) {
  const res = await fetch(`${API_BASE}/auth/company`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ companyName }),
  });
  if (!res.ok) throw new Error('Failed to update company name');
  return res.json();
}

// ===== WebSocket =====
let socket = null;

export function connectSocket(onSensorData) {
  if (socket) socket.disconnect();
  // In production (Docker), SOCKET_URL will be the origin (port 80).
  // In development (Vite), SOCKET_URL will default to origin (port 5173),
  // so we need Vite to proxy it or specify the backend URL.
  socket = io(SOCKET_URL, {
    path: '/socket.io',
  });
  socket.on('sensorData', onSensorData);
  socket.on('connect', () => console.log('[WS] Connected'));
  socket.on('disconnect', () => console.log('[WS] Disconnected'));
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

