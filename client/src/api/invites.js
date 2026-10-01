import { api } from './client.js';

export async function listInvites(params = {}) {
  const { data } = await api.get('/invites', { params });
  return data;
}

export async function createInvite(payload) {
  const { data } = await api.post('/invites', payload);
  return data;
}

export async function revokeInvite(id) {
  const { data } = await api.post(`/invites/${id}/revoke`);
  return data;
}
