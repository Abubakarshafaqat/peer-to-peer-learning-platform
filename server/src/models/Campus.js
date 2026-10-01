import mongoose from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

const campusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      required: true,
      index: true,
    },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

campusSchema.plugin(tenantPlugin);

campusSchema.index({ tenantId: 1, university: 1, slug: 1 }, { unique: true });
campusSchema.index({ tenantId: 1, slug: 1 });

export const Campus = mongoose.model('Campus', campusSchema);
