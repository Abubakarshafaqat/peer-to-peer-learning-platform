import { api } from './client.js';

/** Platform calls intentionally omit x-tenant (client interceptor). */

export async function platformLogin(payload) {
  const { data } = await api.post('/platform/auth/login', payload);
  return data;
}

export async function platformRefresh() {
  const { data } = await api.post('/platform/auth/refresh');
  return data;
}

export async function platformLogout() {
  const { data } = await api.post('/platform/auth/logout');
  return data;
}

export async function platformMe() {
  const { data } = await api.get('/platform/auth/me');
  return data;
}

export async function platformStats() {
  const { data } = await api.get('/platform/stats');
  return data;
}

export async function listPlatformTenants(params = {}) {
  const { data } = await api.get('/platform/tenants', { params });
  return data;
}

export async function createPlatformTenant(payload) {
  const { data } = await api.post('/platform/tenants', payload);
  return data;
}

export async function getPlatformTenant(id) {
  const { data } = await api.get(`/platform/tenants/${id}`);
  return data;
}

export async function updatePlatformTenant(id, payload) {
  const { data } = await api.patch(`/platform/tenants/${id}`, payload);
  return data;
}

export async function setPlatformTenantStatus(id, status) {
  const { data } = await api.patch(`/platform/tenants/${id}/status`, { status });
  return data;
}

export async function deletePlatformTenant(id) {
  const { data } = await api.delete(`/platform/tenants/${id}`);
  return data;
}

export async function getPlatformTenantStats(id) {
  const { data } = await api.get(`/platform/tenants/${id}/stats`);
  return data;
}

export async function getPlatformTenantAudit(id, params = {}) {
  const { data } = await api.get(`/platform/tenants/${id}/audit`, { params });
  return data;
}
