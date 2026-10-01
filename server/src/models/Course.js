import mongoose from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
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

courseSchema.plugin(tenantPlugin);

courseSchema.index({ tenantId: 1, department: 1, slug: 1 }, { unique: true });

export const Course = mongoose.model('Course', courseSchema);
