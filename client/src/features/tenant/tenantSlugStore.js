/** Module-level SaaS tenant slug — source of truth for axios `x-tenant`. Not localStorage. */

let currentSlug = null;
let platformMode = false;

export function getTenantSlug() {
  return currentSlug;
}

export function setTenantSlug(slug) {
  const next = slug ? String(slug).toLowerCase().trim() : null;
  currentSlug = next || null;
}

export function clearTenantSlug() {
  currentSlug = null;
}

/** When true, axios must not send x-tenant (superadmin /platform). */
export function setPlatformMode(enabled) {
  platformMode = Boolean(enabled);
}

export function isPlatformMode() {
  return platformMode;
}
