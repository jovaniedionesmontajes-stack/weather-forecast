const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, options = {}) {
  const token = localStorage.getItem('bakeshop_access_token');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    ...options
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  health: () => request('/api/health'),
  me: () => request('/api/me'),
  branches: () => request('/api/branches'),
  monitoringOverview: () => request('/api/monitoring/overview'),
  alertHistory: (params = {}) => { const q = new URLSearchParams(); if (params.status) q.set('status', params.status); if (params.severity) q.set('severity', params.severity); if (params.limit) q.set('limit', params.limit); const suffix = q.toString() ? `?${q}` : ''; return request(`/api/alerts/history${suffix}`); },
  refreshAlerts: () => request('/api/alerts/refresh', { method: 'POST' }),
  createBranch: (body) => request('/api/branches', { method: 'POST', body: JSON.stringify(body) }),
  updateBranch: (id, body) => request(`/api/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteBranch: (id) => request(`/api/branches/${id}`, { method: 'DELETE' }),
  saveSnapshot: (id) => request(`/api/branches/${id}/snapshot`, { method: 'POST' }),
  forecastHistory: (id, params = {}) => { const q = new URLSearchParams(); if (params.date) q.set('date', params.date); if (params.limit) q.set('limit', params.limit); const suffix = q.toString() ? `?${q}` : ''; return request(`/api/branches/${id}/forecast-history${suffix}`); },
  forecastForTime: (id, observationTime) => request(`/api/branches/${id}/forecast-for-time?observation_time=${encodeURIComponent(observationTime)}`),
  observations: (id) => request(`/api/branches/${id}/observations`),
  createObservation: (id, body) => request(`/api/branches/${id}/observations`, { method: 'POST', body: JSON.stringify(body) }),
  accuracy: (id) => request(`/api/branches/${id}/accuracy`),
  reportsOverview: () => request('/api/reports/overview'),
  runSnapshots: () => request('/api/snapshots/run', { method: 'POST' }),
  users: () => request('/api/users'),
  inviteUser: (body) => request('/api/users/invite', { method:'POST', body:JSON.stringify(body) }),
  updateUser: (id, body) => request(`/api/users/${id}`, { method:'PATCH', body:JSON.stringify(body) }),
  auditLogs: (limit=200) => request(`/api/audit-logs?limit=${limit}`)
};
