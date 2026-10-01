import mongoose from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true,
      index: true,
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

departmentSchema.plugin(tenantPlugin);

departmentSchema.index({ tenantId: 1, campus: 1, slug: 1 }, { unique: true });

export const Department = mongoose.model('Department', departmentSchema);
