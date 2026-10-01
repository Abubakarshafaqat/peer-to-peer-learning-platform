import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant context (shared DB, shared collections).
 * Pair with tenantPlugin so queries inherit tenantId automatically.
 */
const storage = new AsyncLocalStorage();

export function runWithTenantContext(store, fn) {
  return storage.run(store, fn);
}

export function getTenantContext() {
  return storage.getStore() || null;
}

export function getTenantId() {
  const ctx = getTenantContext();
  if (!ctx?.tenantId) return null;
  return ctx.tenantId;
}

export function getTenantDoc() {
  return getTenantContext()?.tenant || null;
}

/** Explicit superadmin / migration bypass flag for the current async context */
export function isTenantBypass() {
  return Boolean(getTenantContext()?.bypassTenant);
}

export function setTenantContextFields(fields) {
  const current = getTenantContext();
  if (!current) return;
  Object.assign(current, fields);
}
