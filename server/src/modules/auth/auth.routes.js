import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.validation.js';

const router = Router();

// SRS-01..29 Auth routes
router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));

router.post('/logout', asyncHandler(authController.logout));

router.post('/refresh', authRateLimiter, asyncHandler(authController.refresh));

router.get('/me', authenticate, asyncHandler(authController.me));

router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(authController.updateMe),
);

router.post(
  '/change-password',
  authenticate,
  authRateLimiter,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

router.post(
  '/forgot-password',
  otpRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

router.post(
  '/reset-password',
  otpRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

export default router;
