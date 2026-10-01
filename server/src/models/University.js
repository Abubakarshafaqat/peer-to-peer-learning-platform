import mongoose from 'mongoose';

/**
 * @deprecated Prefer Tenant for SaaS isolation. Kept for legacy org refs and
 * migration (Tenant.legacyUniversityId). Do not delete the collection yet.
 */
const universitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const University = mongoose.model('University', universitySchema);
