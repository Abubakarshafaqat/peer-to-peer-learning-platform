import { api, getAccessToken } from './client.js';
import { getTenantSlug } from '../features/tenant/tenantSlugStore.js';

export async function listApprovedMaterials(params = {}) {
  const { data } = await api.get('/materials', { params });
  return data;
}

export async function listMyMaterials(params = {}) {
  const { data } = await api.get('/materials/mine', { params });
  return data;
}

export async function listPendingMaterials(params = {}) {
  const { data } = await api.get('/materials/pending', { params });
  return data;
}

export async function getMaterial(id) {
  const { data } = await api.get(`/materials/${id}`);
  return data;
}

export async function uploadMaterial(formData) {
  const { data } = await api.post('/materials', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateMaterial(id, payload) {
  const { data } = await api.patch(`/materials/${id}`, payload);
  return data;
}

export async function deleteMaterial(id) {
  const { data } = await api.delete(`/materials/${id}`);
  return data;
}

export async function moderateMaterial(id, payload) {
  const { data } = await api.patch(`/materials/${id}/moderation`, payload);
  return data;
}

export async function getMaterialFileUrl(id) {
  const { data } = await api.get(`/materials/${id}/file-url`);
  return data;
}

/** Fetch file as blob with auth + x-tenant (for local storage + PDF preview) */
export async function fetchMaterialFileBlob(id, { preview = false } = {}) {
  const baseURL = import.meta.env.VITE_API_URL || '/api/v1';
  const token = getAccessToken();
  const slug = getTenantSlug();
  const qs = preview ? '?preview=1' : '';
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (slug) headers['x-tenant'] = slug;
  const res = await fetch(`${baseURL}/materials/${id}/file${qs}`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load file');
  }
  return res.blob();
}
