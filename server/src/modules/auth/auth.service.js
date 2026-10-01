import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { Tenant } from '../../models/Tenant.js';
import { Campus } from '../../models/Campus.js';
import { Department } from '../../models/Department.js';
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
import { storageService } from '../../services/storage.service.js';
import { toPublicUser } from './auth.serializer.js';
import { assertAndResolveSignup } from './signupPolicy.js';
import { issueEmailVerification } from './emailVerification.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const ORG_POPULATE = [
  { path: 'university', select: 'name slug' },
  { path: 'campus', select: 'name slug' },
  { path: 'department', select: 'name slug' },
];

/** Access JWT claims: sub, role, tid, adminLevel */
function accessPayload(user) {
  const tid = user.tenantId?._id || user.tenantId || null;

  return {
    sub: String(user._id),
    role: user.role,
    tid: tid ? String(tid) : null,
    adminLevel: user.role === 'tenantAdmin' ? user.adminLevel || null : null,
  };
}

async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(accessPayload(user));
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({
    sub: String(user._id),
    jti,
    tid: user.tenantId ? String(user.tenantId._id || user.tenantId) : null,
  });

  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = await bcrypt.hash(jti, 10);
  const tenantId = user.tenantId?._id || user.tenantId || null;

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: new Date(decoded.exp * 1000),
    userAgent: meta.userAgent || '',
    tenantId: tenantId || null,
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

  const sessions = await RefreshToken.find({ user: payload.sub }).setOptions({ skipTenant: true });
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
    await RefreshToken.deleteOne({ _id: matched._id }).setOptions({ skipTenant: true });
    throw new AppError('Refresh token expired', 401, { code: 'TOKEN_EXPIRED' });
  }

  return { payload, session: matched };
}

export async function registerUser(input, tenant) {
  assertPasswordStrength(input.password);

  if (!tenant?._id) {
    throw new AppError('Tenant context required', 400, { code: 'TENANT_REQUIRED' });
  }
  if (!input.campus || !input.department) {
    throw new AppError('Campus and department are required', 400, { code: 'TENANT_REQUIRED' });
  }

  // Ignore role / tenantId from body (also stripped in app.js for tenantId)
  const fullTenant = await Tenant.findById(tenant._id).select('+settings.inviteCode');
  if (!fullTenant) {
    throw new AppError('Unknown tenant', 404, { code: 'TENANT_NOT_FOUND' });
  }

  const signup = await assertAndResolveSignup(fullTenant, input.email, input.inviteCode);

  const [campus, department] = await Promise.all([
    Campus.findById(input.campus),
    Department.findById(input.department),
  ]);

  if (!campus || campus.isActive === false) {
    throw new AppError('Invalid campus for tenant', 400, { code: 'INVALID_TENANT' });
  }
  if (
    !department ||
    department.isActive === false ||
    String(department.campus) !== String(campus._id)
  ) {
    throw new AppError('Invalid department for campus', 400, { code: 'INVALID_TENANT' });
  }

  // Invite may further constrain campus/department
  if (signup.invite?.campus && String(signup.invite.campus) !== String(campus._id)) {
    throw new AppError('Campus does not match invite', 403, { code: 'INVITE_SCOPE' });
  }
  if (signup.invite?.department && String(signup.invite.department) !== String(department._id)) {
    throw new AppError('Department does not match invite', 403, { code: 'INVITE_SCOPE' });
  }

  const universityId = campus.university;
  if (input.university && String(input.university) !== String(universityId)) {
    throw new AppError('University does not match campus', 400, { code: 'TAXONOMY_MISMATCH' });
  }

  // Duplicate only within current tenant — same generic message (no cross-tenant leak)
  const existing = await User.findOne({
    $or: [{ email: input.email }, { username: input.username }],
  });
  if (existing) {
    throw new AppError('Username or email already in use', 409, { code: 'DUPLICATE_USER' });
  }

  const needsVerification = signup.via === 'domain';
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    fullName: input.fullName,
    username: input.username,
    email: input.email,
    phone: input.phone || '',
    passwordHash,
    role: 'student', // always — body role ignored
    tenantId: tenant._id, // always from resolved tenant — body tenantId ignored
    university: universityId,
    campus: campus._id,
    department: department._id,
    emailVerified: !needsVerification,
  });

  if (needsVerification) {
    await issueEmailVerification(user);
  }

  await user.populate(ORG_POPULATE);
  return toPublicUser(user);
}

/** Tenant login — rejects accounts with tenantId null (superadmin must use platform login) */
export async function loginUser(input, meta, res, tenant) {
  const identifier = input.identifier.trim().toLowerCase();

  if (!tenant?._id) {
    throw new AppError('Tenant context required', 400, { code: 'TENANT_REQUIRED' });
  }

  let user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+passwordHash');

  if (!user) {
    const maybePlatform = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    })
      .setOptions({ skipTenant: true })
      .select('+passwordHash');
    if (maybePlatform && !maybePlatform.tenantId) {
      throw new AppError('Use platform login for this account', 403, {
        code: 'USE_PLATFORM_LOGIN',
      });
    }
    throw new AppError('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' });
  }

  if (!(await comparePassword(input.password, user.passwordHash))) {
    throw new AppError('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' });
  }

  if (!user.tenantId) {
    throw new AppError('Use platform login for this account', 403, {
      code: 'USE_PLATFORM_LOGIN',
    });
  }

  if (String(user.tenantId) !== String(tenant._id)) {
    throw new AppError('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' });
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403, { code: 'ACCOUNT_INACTIVE' });
  }

  user.lastSeenAt = new Date();
  await user.save();
  await user.populate(ORG_POPULATE);

  const tokens = await issueTokenPair(user, meta);
  setRefreshCookie(res, tokens.refreshToken);

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
  };
}

/** Platform superadmin login — no x-tenant */
export async function platformLoginUser(input, meta, res) {
  const identifier = input.identifier.trim().toLowerCase();

  const user = await User.findOne({
    role: 'superadmin',
    $or: [{ email: identifier }, { username: identifier }],
  })
    .setOptions({ skipTenant: true })
    .select('+passwordHash');

  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    throw new AppError('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' });
  }
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403, { code: 'ACCOUNT_INACTIVE' });
  }

  user.lastSeenAt = new Date();
  await user.save({ validateBeforeSave: true });

  const accessToken = signAccessToken(accessPayload(user));
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: String(user._id), jti, tid: null });
  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = await bcrypt.hash(jti, 10);

  setRefreshCookie(res, refreshToken);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: new Date(decoded.exp * 1000),
    userAgent: meta.userAgent || '',
    tenantId: null,
  });

  return {
    user: toPublicUser(user),
    accessToken,
  };
}

export async function logoutUser(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const { session } = await findValidRefreshSession(token);
      await RefreshToken.deleteOne({ _id: session._id }).setOptions({ skipTenant: true });
    } catch {
      // still clear cookie
    }
  }
  clearRefreshCookie(res);
}

/** Tenant refresh — must run inside resolveTenant; session.tenantId must match */
export async function refreshSession(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new AppError('Refresh token missing', 401, { code: 'UNAUTHORIZED' });
  }
  if (!req.tenant?._id) {
    throw new AppError('Tenant context required', 400, { code: 'TENANT_REQUIRED' });
  }

  const { session } = await findValidRefreshSession(token);

  if (!session.tenantId || String(session.tenantId) !== String(req.tenant._id)) {
    clearRefreshCookie(res);
    throw new AppError('Refresh token tenant mismatch', 403, { code: 'TENANT_MISMATCH' });
  }

  await RefreshToken.deleteOne({ _id: session._id }).setOptions({ skipTenant: true });

  const user = await User.findById(session.user).setOptions({ skipTenant: true });
  if (!user || !user.isActive || !user.tenantId) {
    clearRefreshCookie(res);
    throw new AppError('Account unavailable', 401, { code: 'UNAUTHORIZED' });
  }
  if (String(user.tenantId) !== String(req.tenant._id)) {
    clearRefreshCookie(res);
    throw new AppError('Token tenant mismatch', 403, { code: 'TENANT_MISMATCH' });
  }

  await user.populate(ORG_POPULATE);
  const tokens = await issueTokenPair(user, {
    userAgent: req.headers['user-agent'] || '',
  });
  setRefreshCookie(res, tokens.refreshToken);

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
  };
}

export async function platformRefreshSession(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new AppError('Refresh token missing', 401, { code: 'UNAUTHORIZED' });
  }

  const { session } = await findValidRefreshSession(token);
  if (session.tenantId) {
    clearRefreshCookie(res);
    throw new AppError('Not a platform session', 403, { code: 'PLATFORM_ONLY' });
  }

  await RefreshToken.deleteOne({ _id: session._id }).setOptions({ skipTenant: true });

  const user = await User.findById(session.user).setOptions({ skipTenant: true });
  if (!user || !user.isActive || user.role !== 'superadmin') {
    clearRefreshCookie(res);
    throw new AppError('Account unavailable', 401, { code: 'UNAUTHORIZED' });
  }

  const accessToken = signAccessToken(accessPayload(user));
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: String(user._id), jti, tid: null });
  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = await bcrypt.hash(jti, 10);
  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: new Date(decoded.exp * 1000),
    userAgent: req.headers['user-agent'] || '',
    tenantId: null,
  });
  setRefreshCookie(res, refreshToken);

  return { user: toPublicUser(user), accessToken };
}

export async function getMe(userId) {
  const user = await User.findById(userId).setOptions({ skipTenant: true }).populate(ORG_POPULATE);
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });
  return toPublicUser(user);
}

export async function updateProfile(userId, input) {
  const user = await User.findById(userId).setOptions({ skipTenant: true });
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });

  const assignable = [
    'fullName',
    'phone',
    'avatarUrl',
    'bio',
    'city',
    'country',
    'program',
    'semester',
    'gender',
    'linkedinUrl',
    'websiteUrl',
  ];
  for (const key of assignable) {
    if (input[key] !== undefined) user[key] = input[key];
  }
  if (input.dateOfBirth !== undefined) {
    user.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  }

  await user.save();
  await user.populate(ORG_POPULATE);
  return toPublicUser(user);
}

export async function updateAvatar(userId, file) {
  if (!file) throw new AppError('Image file is required', 400, { code: 'NO_FILE' });
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!allowed.has(file.mimetype)) {
    throw new AppError('Avatar must be JPG, PNG, WEBP, or GIF', 400, { code: 'INVALID_FILE_TYPE' });
  }

  const user = await User.findById(userId).setOptions({ skipTenant: true });
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });

  const stored = await storageService.upload(file);
  if (stored.provider === 'local') {
    user.avatarUrl = `/uploads/${stored.publicId}`;
  } else {
    const signed = await storageService.getSignedUrl(stored, 60 * 60 * 24 * 30);
    user.avatarUrl = signed || stored.deliveryRef;
  }
  await user.save();
  await user.populate(ORG_POPULATE);
  return toPublicUser(user);
}

export async function changePassword(userId, input) {
  assertPasswordStrength(input.newPassword);
  const user = await User.findById(userId)
    .setOptions({ skipTenant: true })
    .select('+passwordHash');
  if (!user) throw new AppError('User not found', 404, { code: 'NOT_FOUND' });

  const ok = await comparePassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError('Current password is incorrect', 400, { code: 'WRONG_PASSWORD' });
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();
  await RefreshToken.deleteMany({ user: user._id }).setOptions({ skipTenant: true });
}

export async function requestPasswordReset(email, tenant) {
  const user = await User.findOne({ email }).select('+resetOtp');
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
  await RefreshToken.deleteMany({ user: user._id }).setOptions({ skipTenant: true });
}

/** Revoke all refresh tokens for users of a suspended tenant */
export async function revokeRefreshTokensForTenant(tenantId) {
  await RefreshToken.deleteMany({ tenantId }).setOptions({ skipTenant: true });
}

/** Revoke all refresh sessions for one user (deactivate / demote / password change) */
export async function revokeRefreshTokensForUser(userId) {
  await RefreshToken.deleteMany({ user: userId }).setOptions({ skipTenant: true });
}

/** Complete one-time password setup for platform-created tenantAdmin */
export async function setPasswordWithSetupToken({ email, token, newPassword }) {
  assertPasswordStrength(newPassword);
  const user = await User.findOne({ email: String(email).trim().toLowerCase() })
    .select('+passwordSetup.hash +passwordSetup.expiresAt +passwordHash')
    .setOptions({ skipTenant: true });

  if (
    !user ||
    !user.passwordSetup?.hash ||
    !user.passwordSetup?.expiresAt ||
    user.passwordSetup.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError('Invalid or expired setup link', 400, { code: 'SETUP_INVALID' });
  }

  const ok = await compareOtp(token, user.passwordSetup.hash);
  if (!ok) {
    throw new AppError('Invalid or expired setup link', 400, { code: 'SETUP_INVALID' });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordSetup = { hash: null, expiresAt: null };
  await user.save();
  await RefreshToken.deleteMany({ user: user._id }).setOptions({ skipTenant: true });
  return toPublicUser(user);
}

export {
  verifyEmailWithToken,
  resendEmailVerification,
} from './emailVerification.js';
