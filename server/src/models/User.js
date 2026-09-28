import mongoose from 'mongoose';
import { userRoles } from '../config/constants.js';

const awayModeSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    until: { type: Date, default: null },
  },
  { _id: false },
);

const resetOtpSchema = new mongoose.Schema(
  {
    hash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: userRoles, default: 'student', index: true },
    avatarUrl: { type: String, default: '' },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', default: null },
    isActive: { type: Boolean, default: true, index: true },
    awayMode: { type: awayModeSchema, default: () => ({}) },
    lastSeenAt: { type: Date, default: null },
    resetOtp: { type: resetOtpSchema, default: () => ({}), select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model('User', userSchema);
