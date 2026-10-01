import { Tenant } from '../models/Tenant.js';
import { AppError } from '../utils/AppError.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { getCachedTenant, setCachedTenant } from '../utils/tenantCache.js';
import { asyncHandler } from './asyncHandler.js';
import { getAdminLevel, idOf } from '../utils/orgScope.js';
import { TENANT_SLUG_RE } from '../config/constants.js';

export { TENANT_SLUG_RE };

const SHARED_HOST_SUFFIXES = ['.vercel.app', '.onrender.com'];

/**
 * Resolve tenant slug from x-tenant header (preferred) or subdomain.
 * Never trust tenantId from body/query/params.
 */
export function extractTenantSlug(req) {
  const header = req.headers['x-tenant'];
  if (header && String(header).trim()) {
    return String(header).trim().toLowerCase();
  }

  const host = String(req.hostname || '')
    .split(':')[0]
    .toLowerCase();

  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  if (SHARED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return null;

  const parts = host.split('.');
  // need at least subdomain.domain.tld
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (sub === 'www') return null;
  return sub;
}

export function assertValidTenantSlug(slug) {
  if (!slug || !TENANT_SLUG_RE.test(slug)) {
    throw new AppError('Invalid tenant slug', 400, { code: 'TENANT_SLUG_INVALID' });
  }
}

/**
 * Load tenant by slug (not via tenantPlugin — Tenant is global).
 * Uses 60s memory cache.
 */
export async function loadTenantBySlug(slug, { allowSuspended = false } = {}) {
  assertValidTenantSlug(slug);

  let tenant = getCachedTenant(slug);
  if (!tenant) {
    tenant = await Tenant.findOne({ slug }).select('+settings.inviteCode');
    if (tenant) setCachedTenant(slug, tenant);
  }

  if (!tenant) {
    throw new AppError('Unknown tenant', 404, { code: 'TENANT_NOT_FOUND' });
  }
  if (tenant.deletedAt) {
    throw new AppError('Unknown tenant', 404, { code: 'TENANT_NOT_FOUND' });
  }
  if (tenant.status === 'suspended' && !allowSuspended) {
    throw new AppError('Tenant is suspended', 403, { code: 'TENANT_SUSPENDED' });
  }
  if (tenant.status !== 'active' && tenant.status !== 'suspended') {
    throw new AppError('Tenant is not active', 403, { code: 'TENANT_INACTIVE' });
  }
  return tenant;
}

/**
 * Required tenant resolution. Handlers after `next()` run in this ALS store;
 * async continuations (await / Promise.all / Mongoose) keep the same store.
 */
export const resolveTenant = asyncHandler(async (req, _res, next) => {
  const slug = extractTenantSlug(req);
  if (!slug) {
    throw new AppError('Tenant required (x-tenant header or subdomain)', 400, {
      code: 'TENANT_REQUIRED',
    });
  }

  const tenant = await loadTenantBySlug(slug);

  req.tenant = tenant;
  req.tenantId = tenant._id;
  req.tenantSlug = tenant.slug;

  runWithTenantContext({ tenantId: tenant._id, tenant }, () => {
    next();
  });
});

/**
 * Inside-tenant campus/department scope after authenticate.
 * Does not change SaaS tenantId.
 */
export function attachOrgScope(req, _res, next) {
  const user = req.user;

  if (user?.role === 'tenantAdmin') {
    const level = getAdminLevel(user);
    req.isPlatformAdmin = false;
    req.isOrgAdmin = true;
    req.adminLevel = level;
    req.universityId = idOf(user.university);
    req.campusId =
      level === 'university' ? req.query.campus || idOf(user.campus) : idOf(user.campus);
    req.departmentId =
      level === 'department'
        ? idOf(user.department)
        : req.query.department || idOf(user.department);
    req.tenantScope = 'admin';
    return next();
  }

  if (user) {
    req.isPlatformAdmin = false;
    req.isOrgAdmin = false;
    req.adminLevel = null;
    req.universityId = idOf(user.university);
    req.campusId = idOf(user.campus);
    req.departmentId = idOf(user.department);
    req.tenantScope = 'tenant';
    return next();
  }

  req.isPlatformAdmin = false;
  req.isOrgAdmin = false;
  req.adminLevel = null;
  req.universityId = req.query.university || null;
  req.campusId = req.query.campus || null;
  req.departmentId = req.query.department || null;
  req.tenantScope = 'guest';
  return next();
}
