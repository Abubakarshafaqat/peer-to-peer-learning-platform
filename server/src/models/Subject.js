import mongoose from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

subjectSchema.plugin(tenantPlugin);

subjectSchema.index({ tenantId: 1, course: 1, slug: 1 }, { unique: true });

export const Subject = mongoose.model('Subject', subjectSchema);
