import axios from 'axios';
import { getTenantSlug, isPlatformMode } from '../features/tenant/tenantSlugStore.js';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken = null;
let refreshPromise = null;
let onAuthCleared = null;
let onTenantFault = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

/** Register session-clear callback (AuthProvider). */
export function setAuthClearedHandler(fn) {
  onAuthCleared = fn;
}

/** Register TENANT_MISMATCH / suspended handler. */
export function setTenantFaultHandler(fn) {
  onTenantFault = fn;
}

function attachErrorMeta(error, axiosError) {
  const data = axiosError.response?.data;
  error.code = data?.code;
  error.status = axiosError.response?.status;
  error.details = data?.details;
  return error;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  const url = String(config.url || '');
  const skipTenant =
    isPlatformMode() ||
    url.includes('/platform') ||
    url.startsWith('/tenants') ||
    url.includes('/tenants/');

  if (!skipTenant && !config.headers['x-tenant']) {
    const slug = getTenantSlug();
    if (slug) {
      config.headers['x-tenant'] = slug;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const url = original?.url || '';

    if (
      status === 403 &&
      (code === 'TENANT_MISMATCH' || code === 'TENANT_SUSPENDED' || code === 'TENANT_INACTIVE')
    ) {
      clearAccessToken();
      onTenantFault?.({ code, message: error.response?.data?.message });
      const err = attachErrorMeta(
        new Error(error.response?.data?.message || 'Tenant session invalid'),
        error,
      );
      return Promise.reject(err);
    }

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/refresh') &&
      !url.includes('/platform/auth/')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          const refreshPath = isPlatformMode() ? '/platform/auth/refresh' : '/auth/refresh';
          refreshPromise = api.post(refreshPath).then((res) => {
            const token = res.data?.data?.accessToken;
            setAccessToken(token);
            return token;
          });
        }
        const token = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        clearAccessToken();
        onAuthCleared?.();
        const err = attachErrorMeta(
          new Error(
            refreshError.response?.data?.message || refreshError.message || 'Session expired',
          ),
          refreshError,
        );
        return Promise.reject(err);
      }
    }

    const message = error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(attachErrorMeta(new Error(message), error));
  },
);
