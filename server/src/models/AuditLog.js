import mongoose from 'mongoose';

/**
 * Platform + tenant audit trail. Not tenant-plugin-scoped —
 * callers filter by tenantId explicitly. Never store secrets/tokens.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    role: { type: String, default: '', index: true },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    target: {
      type: { type: String, default: '' },
      id: { type: String, default: '' },
      label: { type: String, default: '' },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
