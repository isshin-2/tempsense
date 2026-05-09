import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001/api';

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

export function exportCSV(params) {
  const qs = new URLSearchParams(params).toString();
  window.open(`${API_BASE}/data/export/csv?${qs}&token=${getToken()}`, '_blank');
}

export function exportPDF(params) {
  const qs = new URLSearchParams(params).toString();
  window.open(`${API_BASE}/data/export/pdf?${qs}&token=${getToken()}`, '_blank');
}

// ===== WebSocket =====
let socket = null;

export function connectSocket(onSensorData) {
  if (socket) socket.disconnect();
  socket = io('http://localhost:3001');
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
