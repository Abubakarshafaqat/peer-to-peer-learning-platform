import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { AppError } from '../../utils/AppError.js';
import {
  assertPasswordStrength,
  compareOtp,
  comparePassword,
  generateOtp,
  hashOtp,
  hashPassword,
} from '../../utils/password.js';
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { mailService } from '../../services/mail.service.js';
import { toPublicUser } from './auth.serializer.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function accessPayload(user) {
  return { sub: String(user._id), role: user.role, username: user.username };
}

async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(accessPayload(user));
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: String(user._id), jti });

  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = await bcrypt.hash(jti, 10);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: new Date(decoded.exp * 1000),
    userAgent: meta.userAgent || '',
  });

  return { accessToken, refreshToken };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

async function findValidRefreshSession(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, { code: 'TOKEN_INVALID' });
  }

  const sessions = await RefreshToken.find({ user: payload.sub });
  let matched = null;
  for (const session of sessions) {
    if (await bcrypt.compare(payload.jti, session.tokenHash)) {
      matched = session;
      break;
    }
  }

  if (!matched) {
    throw new AppError('Refresh session revoked', 401, { code: 'TOKEN_REVOKED' });
  }

  if (matched.expiresAt.getTime() < Date.now()) {
    await RefreshToken.deleteOne({ _id: matched._id });
    throw new AppError('Refresh token expired', 401, { code: 'TOKEN_EXPIRED' });
  }

  return { payload, session: matched };
}

/** // SRS-01..05 Register student */
export async function registerUser(input) {
  assertPasswordStrength(input.password);

  const existing = await User.findOne({
    $or: [{ email: input.email }, { username: input.username }],
  });
  if (existing) {
    throw new AppError('Username or email already in use', 409, { code: 'DUPLICATE_USER' });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    fullName: input.fullName,
    username: input.username,
    email: input.email,
    phone: input.phone || '',
    passwordHash,
    role: 'student',
  });

  return toPublicUser(user);
}

/** // SRS-06..10 Login with username or email */
export async function loginUser(input, meta, res) {
  const identifier = input.identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+passwordHash');

  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    throw new AppError('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' });
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403, { code: 'ACCOUNT_INACTIVE' });
  }

  user.lastSeenAt = new Date();
  await user.save();

  const tokens = await issueTokenPair(user, meta);
  setRefreshCookie(res, tokens.refreshToken);

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
  };
}

/** // SRS-11 Logout */
export async function logoutUser(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const { session } = await findValidRefreshSession(token);
      await RefreshToken.deleteOne({ _id: session._id });
    } catch {
      // still clear cookie
    }
  }
  clearRefreshCookie(res);
}

/** Refresh access token using httpOnly cookie */
export async function refreshSession(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new AppError('Refresh token missing', 401, { code: 'UNAUTHORIZED' });
  }

  const { payload, session } = await findValidRefreshSession(token);
  await RefreshToken.deleteOne({ _id: session._id });

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    clearRefreshCookie(res);
    throw new AppError('Account unavailable', 401, { code: 'UNAUTHORIZED' });
  }

  const tokens = await issueTokenPair(user, {
    userAgent: req.headers['user-agent'] || '',
  });
  setRefreshCookie(res, tokens.refreshToken);

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
  };
}

/** // SRS-12..15 Current user / profile */
export async function getMe(userId) {
  const user = await User.findById(userId).populate('university', 'name slug');
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });
  return toPublicUser(user);
}

export async function updateProfile(userId, input) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });

  if (input.fullName !== undefined) user.fullName = input.fullName;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
  if (input.university !== undefined) {
    user.university = input.university || null;
  }

  await user.save();
  await user.populate('university', 'name slug');
  return toPublicUser(user);
}

/** // SRS-16..20 Change password */
export async function changePassword(userId, input) {
  assertPasswordStrength(input.newPassword);

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });

  const ok = await comparePassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError('Current password is incorrect', 400, { code: 'WRONG_PASSWORD' });
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
}

/** // SRS-21..25 Forgot password — email OTP */
export async function requestPasswordReset(email) {
  const user = await User.findOne({ email }).select('+resetOtp');
  // Always succeed to avoid account enumeration
  if (!user) return { sent: true };

  const otp = generateOtp(6);
  user.resetOtp = {
    hash: await hashOtp(otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
  };
  await user.save();

  await mailService.sendPasswordResetOtp(user.email, otp, user.fullName);
  return { sent: true };
}

/** // SRS-21..25 Reset password with OTP */
export async function resetPasswordWithOtp(input) {
  assertPasswordStrength(input.newPassword);

  const user = await User.findOne({ email: input.email }).select('+resetOtp +passwordHash');
  if (!user?.resetOtp?.hash) {
    throw new AppError('Invalid or expired OTP', 400, { code: 'OTP_INVALID' });
  }

  if (user.resetOtp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError('Too many OTP attempts', 429, { code: 'OTP_LOCKED' });
  }

  if (!user.resetOtp.expiresAt || user.resetOtp.expiresAt.getTime() < Date.now()) {
    throw new AppError('OTP expired', 400, { code: 'OTP_EXPIRED' });
  }

  const valid = await compareOtp(input.otp, user.resetOtp.hash);
  if (!valid) {
    user.resetOtp.attempts += 1;
    await user.save();
    throw new AppError('Invalid or expired OTP', 400, { code: 'OTP_INVALID' });
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.resetOtp = { hash: null, expiresAt: null, attempts: 0 };
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
}
