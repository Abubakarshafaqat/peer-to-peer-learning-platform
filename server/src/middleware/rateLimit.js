import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    data: null,
    message: 'Too many auth attempts. Try again later.',
    code: 'RATE_LIMITED',
  },
});

export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    data: null,
    message: 'Too many OTP requests. Try again later.',
    code: 'RATE_LIMITED',
  },
});

/** Public tenant picker / branding list */
export const publicTenantsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    data: null,
    message: 'Too many requests. Try again later.',
    code: 'RATE_LIMITED',
  },
});

/** Signup + invite redeem: per IP and per tenant */
export const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const tenant =
      req.tenantSlug ||
      req.headers['x-tenant'] ||
      (typeof req.hostname === 'string' ? req.hostname.split('.')[0] : 'none');
    return `signup:${ip}:${String(tenant).toLowerCase()}`;
  },
  message: {
    success: false,
    data: null,
    message: 'Too many signup attempts. Try again later.',
    code: 'RATE_LIMITED',
  },
});
