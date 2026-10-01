const SLUG_RE = /^[a-z0-9-]{2,40}$/;

/**
 * Parse SaaS tenant slug from hostname.
 * Ignores www, bare localhost, and *.vercel.app preview hosts.
 * @param {string} hostname
 * @returns {string|null}
 */
export function slugFromHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .split(':')[0]
    .trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;

  let parts = host.split('.').filter(Boolean);
  if (parts[0] === 'www') parts = parts.slice(1);

  if (!parts.length) return null;

  // *.vercel.app — ignore preview deployments
  if (parts.length >= 2 && parts.slice(-2).join('.') === 'vercel.app') return null;

  // foo.localhost → foo
  if (parts[parts.length - 1] === 'localhost') {
    if (parts.length < 2) return null;
    const slug = parts[0];
    return SLUG_RE.test(slug) ? slug : null;
  }

  // Need slug.domain.tld (at least 3 labels)
  if (parts.length < 3) return null;
  const slug = parts[0];
  return SLUG_RE.test(slug) ? slug : null;
}

/**
 * Resolve tenant slug in priority order:
 * subdomain → /t/:slug → VITE_TENANT_SLUG (dev only) → null (show picker)
 */
export function resolveTenantSlug({
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  routeSlug = null,
  envSlug = null,
  isDev = typeof import.meta !== 'undefined' ? Boolean(import.meta.env?.DEV) : false,
} = {}) {
  const fromHost = slugFromHostname(hostname);
  if (fromHost) return { slug: fromHost, source: 'subdomain' };

  const fromRoute = routeSlug ? String(routeSlug).toLowerCase().trim() : '';
  if (fromRoute && SLUG_RE.test(fromRoute)) return { slug: fromRoute, source: 'route' };

  if (isDev) {
    const fromEnv = envSlug ? String(envSlug).toLowerCase().trim() : '';
    if (fromEnv && SLUG_RE.test(fromEnv)) return { slug: fromEnv, source: 'env' };
  }

  return { slug: null, source: null };
}

export function isValidTenantSlug(slug) {
  return SLUG_RE.test(String(slug || '').toLowerCase());
}

export { SLUG_RE };
