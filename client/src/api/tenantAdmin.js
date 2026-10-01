import { api } from './client.js';

export async function getTenantSettings() {
  const { data } = await api.get('/tenant-admin/tenant');
  return data;
}

export async function updateTenantSettings(payload) {
  const { data } = await api.patch('/tenant-admin/tenant', payload);
  return data;
}

export async function listTenantUsers(params = {}) {
  const { data } = await api.get('/tenant-admin/users', { params });
  return data;
}

export async function setUserActive(userId, isActive) {
  const { data } = await api.patch(`/tenant-admin/users/${userId}/active`, { isActive });
  return data;
}

export async function setUserRole(userId, payload) {
  const { data } = await api.patch(`/tenant-admin/users/${userId}/role`, payload);
  return data;
}

export async function listModerationPending(params = {}) {
  const { data } = await api.get('/tenant-admin/moderation/pending', { params });
  return data;
}

export async function moderateMaterial(id, payload) {
  const { data } = await api.patch(`/tenant-admin/moderation/${id}`, payload);
  return data;
}

export async function listTenantAudit(params = {}) {
  const { data } = await api.get('/tenant-admin/audit', { params });
  return data;
}
