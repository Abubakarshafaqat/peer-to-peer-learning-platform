import { sendSuccess } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

// SRS-01..05 Register
export async function register(req, res) {
  const user = await authService.registerUser(req.body);
  return sendSuccess(res, {
    status: 201,
    message: 'Registered successfully',
    data: { user },
  });
}

// SRS-06..10 Login
export async function login(req, res) {
  const data = await authService.loginUser(
    req.body,
    { userAgent: req.headers['user-agent'] || '' },
    res,
  );
  return sendSuccess(res, { message: 'Logged in', data });
}

// SRS-11 Logout
export async function logout(req, res) {
  await authService.logoutUser(req, res);
  return sendSuccess(res, { message: 'Logged out', data: null });
}

export async function refresh(req, res) {
  const data = await authService.refreshSession(req, res);
  return sendSuccess(res, { message: 'Token refreshed', data });
}

// SRS-12..15 Me
export async function me(req, res) {
  const user = await authService.getMe(req.user._id);
  return sendSuccess(res, { data: { user } });
}

export async function updateMe(req, res) {
  const user = await authService.updateProfile(req.user._id, req.body);
  return sendSuccess(res, { message: 'Profile updated', data: { user } });
}

// SRS-16..20 Change password
export async function changePassword(req, res) {
  await authService.changePassword(req.user._id, req.body);
  return sendSuccess(res, { message: 'Password changed. Please sign in again.', data: null });
}

// SRS-21..25 Forgot / reset
export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  return sendSuccess(res, {
    message: 'If that email exists, a reset code has been sent.',
    data: null,
  });
}

export async function resetPassword(req, res) {
  await authService.resetPasswordWithOtp(req.body);
  return sendSuccess(res, { message: 'Password reset successful', data: null });
}
