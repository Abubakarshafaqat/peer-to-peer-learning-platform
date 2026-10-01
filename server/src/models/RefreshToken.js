import mongoose from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);

// optional: superadmin sessions have tenantId null; token lookup uses skipTenant
refreshTokenSchema.plugin(tenantPlugin, { optional: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ tenantId: 1, user: 1 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
