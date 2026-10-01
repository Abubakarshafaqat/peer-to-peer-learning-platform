import mongoose from 'mongoose';
import { userRoles, adminLevels } from '../config/constants.js';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

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
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: userRoles, default: 'student', index: true },
    /**
     * Inside-tenant moderation scope for tenantAdmin.
     * null for students; unused for superadmin.
     */
    adminLevel: {
      type: String,
      enum: adminLevels,
      default: undefined,
      index: true,
    },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    country: { type: String, trim: true, maxlength: 80, default: '' },
    program: { type: String, trim: true, maxlength: 120, default: '' },
    semester: { type: String, trim: true, maxlength: 40, default: '' },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say', ''],
      default: '',
    },
    dateOfBirth: { type: Date, default: null },
    linkedinUrl: { type: String, trim: true, default: '' },
    websiteUrl: { type: String, trim: true, default: '' },
    /** Legacy org refs — kept during University→Tenant migration */
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', default: null },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    isActive: { type: Boolean, default: true, index: true },
    /** Domain-mode signup must verify ownership before upload/comment */
    emailVerified: { type: Boolean, default: false, index: true },
    emailVerification: {
      hash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },
    /** One-time password setup for invited first tenantAdmin (platform create) */
    passwordSetup: {
      hash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },
    awayMode: { type: awayModeSchema, default: () => ({}) },
    lastSeenAt: { type: Date, default: null },
    resetOtp: { type: resetOtpSchema, default: () => ({}), select: false },
  },
  { timestamps: true },
);

// tenantId optional so superadmin can have null
userSchema.plugin(tenantPlugin, { optional: true });

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ university: 1, campus: 1, department: 1 });

// Per-tenant uniqueness (students + tenantAdmins)
userSchema.index(
  { tenantId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: { $type: 'objectId' } },
  },
);
userSchema.index(
  { tenantId: 1, username: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: { $type: 'objectId' } },
  },
);

// Superadmin emails/usernames unique globally (tenantId null)
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: null, role: 'superadmin' },
  },
);
userSchema.index(
  { username: 1 },
  {
    unique: true,
    partialFilterExpression: { tenantId: null, role: 'superadmin' },
  },
);

userSchema.pre('validate', function ensureSuperadminTenant(next) {
  if (this.role === 'superadmin') {
    this.tenantId = null;
    this.adminLevel = undefined;
  } else if (!this.tenantId) {
    return next(new Error('tenantId is required for non-superadmin users'));
  }
  next();
});

export const User = mongoose.model('User', userSchema);
