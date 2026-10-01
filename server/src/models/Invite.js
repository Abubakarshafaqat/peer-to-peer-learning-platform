import mongoose from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

/**
 * Tenant-scoped invite codes. Plain code is shown once at creation; only hash is stored.
 */
const inviteSchema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ['student'],
      default: 'student',
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      default: null,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    maxUses: { type: Number, required: true, min: 1, default: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

inviteSchema.plugin(tenantPlugin);

inviteSchema.index({ tenantId: 1, codeHash: 1 }, { unique: true });
inviteSchema.index({ tenantId: 1, createdAt: -1 });

export const Invite = mongoose.model('Invite', inviteSchema);
