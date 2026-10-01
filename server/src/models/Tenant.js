import mongoose from 'mongoose';

/**
 * Tenant = one university (SaaS isolation root).
 * University model remains during migration; do not delete until confirmed.
 */
const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 64,
    },
    domainWhitelist: [{ type: String, trim: true, lowercase: true }],
    /**
     * How students may join this tenant.
     * If unset, resolved as: domainWhitelist non-empty → "domain", else "invite".
     */
    signupMode: {
      type: String,
      enum: ['domain', 'invite', 'both', 'closed'],
      default: undefined,
    },
    logoUrl: { type: String, default: '' },
    theme: {
      primaryColor: { type: String, default: '#0f766e' },
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    /** Soft delete — never hard-delete tenants */
    deletedAt: { type: Date, default: null, index: true },
    settings: {
      maxUploadMB: { type: Number, default: 50, min: 1, max: 500 },
      allowedFileTypes: {
        type: [String],
        default: () => [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ],
      },
      moderationEnabled: { type: Boolean, default: true },
      /** Optional storage cap in MB; null/0 = unlimited */
      storageQuotaMB: { type: Number, default: null, min: 0, max: 1_000_000 },
      /** @deprecated Prefer Invite model; kept for seed/backward-compat display only */
      inviteCode: { type: String, default: '', select: false },
    },
    /** Set by migration when mapping from legacy University */
    legacyUniversityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      default: null,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

tenantSchema.index({ status: 1, slug: 1 });

/** Effective signup mode (explicit field or derived default). */
export function getSignupMode(tenant) {
  if (tenant?.signupMode) return tenant.signupMode;
  return tenant?.domainWhitelist?.length > 0 ? 'domain' : 'invite';
}

export const Tenant = mongoose.model('Tenant', tenantSchema);
