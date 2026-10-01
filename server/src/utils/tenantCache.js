/**
 * In-memory tenant lookup cache (60s TTL).
 * Call invalidate(slug) after tenant edit/suspend.
 */
const TTL_MS = 60_000;
const cache = new Map();

export function getCachedTenant(slug) {
  const key = String(slug).toLowerCase();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.tenant;
}

export function setCachedTenant(slug, tenant) {
  const key = String(slug).toLowerCase();
  cache.set(key, { tenant, expiresAt: Date.now() + TTL_MS });
}

export function invalidateTenantCache(slug) {
  if (!slug) {
    cache.clear();
    return;
  }
  cache.delete(String(slug).toLowerCase());
}

export function clearTenantCache() {
  cache.clear();
}
