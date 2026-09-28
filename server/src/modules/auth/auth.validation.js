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
  university: z.string().optional().nullable(),
});
