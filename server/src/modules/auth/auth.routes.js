import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authRateLimiter, otpRateLimiter, signupRateLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { uploadAvatarFile } from '../../middleware/uploadAvatar.js';
import { handleMulterError } from '../../middleware/upload.js';
import * as authController from './auth.controller.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  setPasswordSchema,
} from './auth.validation.js';

const router = Router();

router.post(
  '/register',
  signupRateLimiter,
  resolveTenant,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post(
  '/login',
  authRateLimiter,
  resolveTenant,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post('/logout', asyncHandler(authController.logout));

router.post(
  '/refresh',
  authRateLimiter,
  resolveTenant,
  asyncHandler(authController.refresh),
);

router.get('/me', resolveTenant, authenticate, asyncHandler(authController.me));

router.patch(
  '/me',
  resolveTenant,
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(authController.updateMe),
);

router.post(
  '/me/avatar',
  resolveTenant,
  authenticate,
  uploadAvatarFile,
  handleMulterError,
  asyncHandler(authController.uploadAvatar),
);

router.post(
  '/change-password',
  resolveTenant,
  authenticate,
  authRateLimiter,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

router.post(
  '/forgot-password',
  otpRateLimiter,
  resolveTenant,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

router.post(
  '/reset-password',
  otpRateLimiter,
  resolveTenant,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

router.post(
  '/verify-email',
  otpRateLimiter,
  resolveTenant,
  validate(verifyEmailSchema),
  asyncHandler(authController.verifyEmail),
);

router.post(
  '/resend-verification',
  resolveTenant,
  authenticate,
  otpRateLimiter,
  asyncHandler(authController.resendVerification),
);

router.post(
  '/set-password',
  authRateLimiter,
  resolveTenant,
  validate(setPasswordSchema),
  asyncHandler(authController.setPassword),
);

export default router;
