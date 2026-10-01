import { api } from './client.js';

export async function listPublicTenants() {
  const { data } = await api.get('/tenants/public');
  return data;
}

export async function getTenantBranding(slug) {
  const { data } = await api.get(`/tenants/${encodeURIComponent(slug)}/branding`);
  return data;
}
