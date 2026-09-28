import { api } from './client.js';

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout');
  return data;
}

export async function refresh() {
  const { data } = await api.post('/auth/refresh');
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function updateMe(payload) {
  const { data } = await api.patch('/auth/me', payload);
  return data;
}

export async function changePassword(payload) {
  const { data } = await api.post('/auth/change-password', payload);
  return data;
}

export async function forgotPassword(payload) {
  const { data } = await api.post('/auth/forgot-password', payload);
  return data;
}

export async function resetPassword(payload) {
  const { data } = await api.post('/auth/reset-password', payload);
  return data;
}
