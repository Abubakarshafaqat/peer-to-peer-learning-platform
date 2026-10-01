import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from './asyncHandler.js';

function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

const USER_POPULATE = [
  { path: 'university', select: 'name slug' },
  { path: 'campus', select: 'name slug' },
  { path: 'department', select: 'name slug' },
];

/**
 * Tenant routes: token.tid must equal req.tenant._id.
 * Superadmin tokens are rejected here (platform routes only).
 */
function assertTenantBoundToken(req, payload, user) {
  if (user.role === 'superadmin') {
    throw new AppError('Superadmin tokens cannot access tenant routes', 403, {
      code: 'SUPERADMIN_ON_TENANT_ROUTE',
    });
  }

  if (!req.tenant?._id) {
    throw new AppError('Tenant context required', 400, { code: 'TENANT_REQUIRED' });
  }

  const tokenTid = payload.tid != null ? String(payload.tid) : null;
  const userTenant = user.tenantId ? String(user.tenantId) : null;
  const reqTenant = String(req.tenant._id);

  if (!tokenTid || tokenTid !== reqTenant) {
    throw new AppError('Token tenant mismatch', 403, { code: 'TENANT_MISMATCH' });
  }
  if (!userTenant || userTenant !== reqTenant) {
    throw new AppError('User does not belong to this tenant', 403, { code: 'TENANT_FORBIDDEN' });
  }
}

async function loadUserById(id) {
  return User.findById(id).setOptions({ skipTenant: true }).populate(USER_POPULATE);
}

/** Tenant-route authentication */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) {
    throw new AppError('Authentication required', 401, { code: 'UNAUTHORIZED' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired access token', 401, { code: 'TOKEN_INVALID' });
  }

  const user = await loadUserById(payload.sub);
  if (!user || !user.isActive) {
    throw new AppError('Account unavailable', 401, { code: 'UNAUTHORIZED' });
  }

  // Reject stale access tokens after role demotion (DB is source of truth)
  if (payload.role && payload.role !== user.role) {
    throw new AppError('Session outdated — sign in again', 401, { code: 'TOKEN_STALE' });
  }

  assertTenantBoundToken(req, payload, user);

  req.user = user;
  req.authPayload = payload;
  next();
});

/** Platform-route authentication — superadmin only */
export const authenticatePlatform = asyncHandler(async (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) {
    throw new AppError('Authentication required', 401, { code: 'UNAUTHORIZED' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired access token', 401, { code: 'TOKEN_INVALID' });
  }

  if (payload.role !== 'superadmin' || payload.tid != null) {
    throw new AppError('Platform superadmin required', 403, { code: 'PLATFORM_ONLY' });
  }

  const user = await loadUserById(payload.sub);
  if (!user || !user.isActive || user.role !== 'superadmin') {
    throw new AppError('Account unavailable', 401, { code: 'UNAUTHORIZED' });
  }

  req.user = user;
  req.authPayload = payload;
  next();
});

export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await loadUserById(payload.sub);
    if (user?.isActive) {
      assertTenantBoundToken(req, payload, user);
      req.user = user;
      req.authPayload = payload;
    }
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 403) throw err;
  }
  next();
});

export function requireRole(...roles) {
  const allowed = new Set(roles);

  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, { code: 'UNAUTHORIZED' }));
    }
    if (!allowed.has(req.user.role)) {
      return next(new AppError('Forbidden', 403, { code: 'FORBIDDEN' }));
    }
    next();
  };
}
