import { AppError } from '../utils/AppError.js';
import { assertEmailVerified } from '../modules/auth/emailVerification.js';

/** Block unverified students from upload / comment-style actions */
export function requireEmailVerified(req, _res, next) {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, { code: 'UNAUTHORIZED' }));
    }
    assertEmailVerified(req.user);
    return next();
  } catch (err) {
    return next(err);
  }
}
