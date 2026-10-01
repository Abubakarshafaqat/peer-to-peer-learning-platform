import { sendSuccess } from '../../utils/apiResponse.js';
import { toPublicUser } from './auth.serializer.js';
import * as authService from './auth.service.js';

export async function register(req, res) {
  const user = await authService.registerUser(req.body, req.tenant);
  return sendSuccess(res, {
    status: 201,
    message: 'Registered successfully',
    data: { user },
  });
}

export async function login(req, res) {
  const data = await authService.loginUser(
    req.body,
    { userAgent: req.headers['user-agent'] || '' },
    res,
    req.tenant,
  );
  return sendSuccess(res, { message: 'Logged in', data });
}

export async function platformLogin(req, res) {
  const data = await authService.platformLoginUser(
    req.body,
    { userAgent: req.headers['user-agent'] || '' },
    res,
  );
  return sendSuccess(res, { message: 'Logged in', data });
}

export async function logout(req, res) {
  await authService.logoutUser(req, res);
  return sendSuccess(res, { message: 'Logged out', data: null });
}

export async function refresh(req, res) {
  const data = await authService.refreshSession(req, res);
  return sendSuccess(res, { message: 'Token refreshed', data });
}

export async function platformRefresh(req, res) {
  const data = await authService.platformRefreshSession(req, res);
  return sendSuccess(res, { message: 'Token refreshed', data });
}

export async function me(req, res) {
  const user = await authService.getMe(req.user._id);
  return sendSuccess(res, { data: { user } });
}

export async function updateMe(req, res) {
  const user = await authService.updateProfile(req.user._id, req.body);
  return sendSuccess(res, { message: 'Profile updated', data: { user } });
}

export async function uploadAvatar(req, res) {
  const user = await authService.updateAvatar(req.user._id, req.file);
  return sendSuccess(res, { message: 'Avatar updated', data: { user } });
}

export async function changePassword(req, res) {
  await authService.changePassword(req.user._id, req.body);
  return sendSuccess(res, { message: 'Password changed. Please sign in again.', data: null });
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email, req.tenant);
  return sendSuccess(res, {
    message: 'If that email exists, a reset code has been sent.',
    data: null,
  });
}

export async function resetPassword(req, res) {
  await authService.resetPasswordWithOtp(req.body);
  return sendSuccess(res, { message: 'Password reset successful', data: null });
}

export async function verifyEmail(req, res) {
  const user = await authService.verifyEmailWithToken(req.body);
  return sendSuccess(res, {
    message: 'Email verified',
    data: { user: toPublicUser(user) },
  });
}

export async function resendVerification(req, res) {
  await authService.resendEmailVerification(req.user._id);
  return sendSuccess(res, {
    message: 'If verification is needed, a new email has been sent.',
    data: null,
  });
}

export async function setPassword(req, res) {
  const user = await authService.setPasswordWithSetupToken(req.body);
  return sendSuccess(res, { message: 'Password set — you can sign in now', data: { user } });
}
