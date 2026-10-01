import crypto from 'crypto';
import { User } from '../../models/User.js';
import { AppError } from '../../utils/AppError.js';
import { mailService } from '../../services/mail.service.js';
import { env } from '../../config/env.js';
import { hashOtp, compareOtp } from '../../utils/password.js';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function issueEmailVerification(user) {
  const token = generateVerificationToken();
  const hash = await hashOtp(token);
  user.emailVerification = {
    hash,
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  };
  user.emailVerified = false;
  await user.save();

  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  await mailService.sendEmailVerification(user.email, user.fullName, verifyUrl, token);
  return { token }; // returned only for tests / dev; not exposed in HTTP by default
}

export async function verifyEmailWithToken({ email, token }) {
  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select(
    '+emailVerification.hash +emailVerification.expiresAt',
  );
  if (!user) {
    // Generic — do not reveal whether email exists
    throw new AppError('Invalid or expired verification link', 400, {
      code: 'VERIFY_INVALID',
    });
  }
  if (user.emailVerified) {
    return user;
  }
  if (
    !user.emailVerification?.hash ||
    !user.emailVerification?.expiresAt ||
    user.emailVerification.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError('Invalid or expired verification link', 400, {
      code: 'VERIFY_INVALID',
    });
  }
  const ok = await compareOtp(token, user.emailVerification.hash);
  if (!ok) {
    throw new AppError('Invalid or expired verification link', 400, {
      code: 'VERIFY_INVALID',
    });
  }

  user.emailVerified = true;
  user.emailVerification = { hash: null, expiresAt: null };
  await user.save();
  return user;
}

export async function resendEmailVerification(userId) {
  const user = await User.findById(userId).select('+emailVerification.hash');
  if (!user) throw new AppError('User not found', 404);
  if (user.emailVerified) {
    throw new AppError('Email already verified', 400, { code: 'ALREADY_VERIFIED' });
  }
  return issueEmailVerification(user);
}

export function assertEmailVerified(user) {
  if (user?.role === 'superadmin' || user?.role === 'tenantAdmin') return;
  if (!user?.emailVerified) {
    throw new AppError('Verify your email before performing this action', 403, {
      code: 'EMAIL_UNVERIFIED',
    });
  }
}
