import { z } from 'zod';
import { PASSWORD_REGEX } from '../../utils/password.js';

const passwordSchema = z
  .string()
  .regex(PASSWORD_REGEX, 'Password must be 8+ chars with upper, lower, and a number');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().default(''),
  password: passwordSchema,
  university: z.string().regex(/^[a-f\d]{24}$/i, 'Select your university').optional(),
  campus: z.string().regex(/^[a-f\d]{24}$/i, 'Select your campus'),
  department: z.string().regex(/^[a-f\d]{24}$/i, 'Select your department'),
  inviteCode: z.string().trim().optional().default(''),
  // Accepted but ignored — role always student; tenant from x-tenant
  role: z.string().optional(),
  tenantId: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().min(16),
});

export const setPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().min(16),
  newPassword: passwordSchema,
});

export const createInviteSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(10000).optional().default(1),
  expiresAt: z.string().datetime().or(z.string().min(1)).optional(),
  expiresInDays: z.coerce.number().positive().max(365).optional(),
  campus: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  department: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().length(6),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  avatarUrl: z.string().url().or(z.literal('')).optional(),
  bio: z.string().trim().max(500).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  program: z.string().trim().max(120).optional(),
  semester: z.string().trim().max(40).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say', '']).optional(),
  dateOfBirth: z.union([z.string(), z.literal(''), z.null()]).optional(),
  linkedinUrl: z.union([z.string().url(), z.literal('')]).optional(),
  websiteUrl: z.union([z.string().url(), z.literal('')]).optional(),
  // Students cannot change tenant via profile; ignored in service for students
});
