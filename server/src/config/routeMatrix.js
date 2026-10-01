/**
 * Authoritative classification of every /api/v1 route.
 * Classes: public | tenant | tenant-admin | platform
 *
 * - public: no SaaS tenant context required
 * - tenant: requires x-tenant (auth optional or student+)
 * - tenant-admin: requires x-tenant + tenantAdmin
 * - platform: /platform/* (superadmin; skipTenant in handlers)
 *
 * Keep in sync with routers under src/modules — Step 9 tests fail on drift.
 */

/** @typedef {'public'|'tenant'|'tenant-admin'|'platform'} RouteClass */

/**
 * @type {Record<string, { class: RouteClass, auth: string, role: string, tenant: boolean, notes?: string }>}
 */
export const ROUTE_MATRIX = {
  // —— Public ——
  'GET /api/v1': {
    class: 'public',
    auth: 'none',
    role: 'any',
    tenant: false,
  },
  'GET /api/v1/health': {
    class: 'public',
    auth: 'none',
    role: 'any',
    tenant: false,
  },
  'GET /api/v1/tenants': {
    class: 'public',
    auth: 'none',
    role: 'any',
    tenant: false,
    notes: 'deprecated picker; rate limited',
  },
  'GET /api/v1/tenants/public': {
    class: 'public',
    auth: 'none',
    role: 'any',
    tenant: false,
  },
  'GET /api/v1/tenants/:slug/branding': {
    class: 'public',
    auth: 'none',
    role: 'any',
    tenant: false,
  },
  'POST /api/v1/auth/logout': {
    class: 'public',
    auth: 'cookie optional',
    role: 'any',
    tenant: false,
  },

  // —— Tenant-scoped auth (x-tenant required) ——
  'POST /api/v1/auth/register': {
    class: 'tenant',
    auth: 'none',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/auth/login': {
    class: 'tenant',
    auth: 'none',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/auth/refresh': {
    class: 'tenant',
    auth: 'refresh cookie',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/auth/me': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'PATCH /api/v1/auth/me': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'POST /api/v1/auth/me/avatar': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'POST /api/v1/auth/change-password': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'POST /api/v1/auth/forgot-password': {
    class: 'tenant',
    auth: 'none',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/auth/reset-password': {
    class: 'tenant',
    auth: 'none',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/auth/verify-email': {
    class: 'tenant',
    auth: 'none',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/auth/resend-verification': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'POST /api/v1/auth/set-password': {
    class: 'tenant',
    auth: 'setup token',
    role: 'any',
    tenant: true,
  },

  // —— Taxonomy ——
  'GET /api/v1/taxonomy/universities': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/taxonomy/universities/:universityId/campuses': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/taxonomy/campuses/:campusId/departments': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/taxonomy/departments/:departmentId/courses': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/taxonomy/universities/:universityId/courses': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/taxonomy/courses/:courseId/subjects': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/taxonomy/universities': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },

  // —— Materials ——
  'GET /api/v1/materials': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'GET /api/v1/materials/mine': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'GET /api/v1/materials/pending': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'GET /api/v1/materials/:id': {
    class: 'tenant',
    auth: 'optional',
    role: 'any',
    tenant: true,
  },
  'POST /api/v1/materials': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'PATCH /api/v1/materials/:id': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'PATCH /api/v1/materials/:id/moderation': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'DELETE /api/v1/materials/:id': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'GET /api/v1/materials/:id/file': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },
  'GET /api/v1/materials/:id/file-url': {
    class: 'tenant',
    auth: 'bearer',
    role: 'student+',
    tenant: true,
  },

  // —— Invites (tenant admin) ——
  'POST /api/v1/invites': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'GET /api/v1/invites': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'POST /api/v1/invites/:id/revoke': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },

  // —— Tenant admin console ——
  'GET /api/v1/tenant-admin/tenant': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'PATCH /api/v1/tenant-admin/tenant': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'GET /api/v1/tenant-admin/users': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'PATCH /api/v1/tenant-admin/users/:id/active': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'PATCH /api/v1/tenant-admin/users/:id/role': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'GET /api/v1/tenant-admin/moderation/pending': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'PATCH /api/v1/tenant-admin/moderation/:id': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },
  'GET /api/v1/tenant-admin/audit': {
    class: 'tenant-admin',
    auth: 'bearer',
    role: 'tenantAdmin',
    tenant: true,
  },

  // —— Platform ——
  'POST /api/v1/platform/auth/login': {
    class: 'platform',
    auth: 'none',
    role: 'superadmin',
    tenant: false,
  },
  'POST /api/v1/platform/auth/refresh': {
    class: 'platform',
    auth: 'refresh cookie',
    role: 'superadmin',
    tenant: false,
  },
  'POST /api/v1/platform/auth/logout': {
    class: 'platform',
    auth: 'cookie optional',
    role: 'any',
    tenant: false,
  },
  'GET /api/v1/platform/auth/me': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'GET /api/v1/platform/stats': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'GET /api/v1/platform/tenants': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'POST /api/v1/platform/tenants': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'GET /api/v1/platform/tenants/:id': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'PATCH /api/v1/platform/tenants/:id': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'PATCH /api/v1/platform/tenants/:id/status': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'DELETE /api/v1/platform/tenants/:id': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'PATCH /api/v1/platform/tenants/:id/signup-mode': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'GET /api/v1/platform/tenants/:id/stats': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'GET /api/v1/platform/tenants/:id/audit': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'POST /api/v1/platform/tenants/:id/invites': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'GET /api/v1/platform/tenants/:id/invites': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
  'POST /api/v1/platform/tenants/:tenantId/invites/:inviteId/revoke': {
    class: 'platform',
    auth: 'bearer',
    role: 'superadmin',
    tenant: false,
  },
};

export const ROUTE_CLASSES = new Set(['public', 'tenant', 'tenant-admin', 'platform']);

/** Parametric path patterns → match walked Express paths */
export function matrixKeyForWalked(method, walkedPath) {
  const key = `${method} ${walkedPath}`;
  if (ROUTE_MATRIX[key]) return key;

  // Express may expand or leave params as :name — try fuzzy match
  for (const catalogKey of Object.keys(ROUTE_MATRIX)) {
    const [m, p] = catalogKey.split(' ');
    if (m !== method) continue;
    const re = new RegExp(`^${p.replace(/:[^/]+/g, '[^/]+')}$`);
    if (re.test(walkedPath)) return catalogKey;
  }
  return null;
}
