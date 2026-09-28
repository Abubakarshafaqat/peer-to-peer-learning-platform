import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from './asyncHandler.js';

function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/** // SRS-01..29 Attach authenticated user from access JWT */
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

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new AppError('Account unavailable', 401, { code: 'UNAUTHORIZED' });
  }

  req.user = user;
  next();
});

/** Optional auth — guests allowed */
export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user?.isActive) req.user = user;
  } catch {
    // ignore invalid token for optional auth
  }
  next();
});

/** // SRS-01..29 Role-based access control */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, { code: 'UNAUTHORIZED' }));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden', 403, { code: 'FORBIDDEN' }));
    }
    next();
  };
}
