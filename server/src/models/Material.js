import mongoose from 'mongoose';
import { materialStatuses, materialTypes } from '../config/constants.js';
import { tenantPlugin } from '../plugins/tenantPlugin.js';

const fileSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    deliveryRef: { type: String, required: true },
    provider: { type: String, enum: ['cloudinary', 'local'], default: 'local' },
    /** Cloudinary resource_type: image | raw */
    resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
    mimeType: { type: String, required: true },
    /** Size in bytes (legacy field name) */
    size: { type: Number, required: true },
    /** Explicit bytes field (same as size; preferred in new code) */
    bytes: { type: Number, required: true },
    originalName: { type: String, required: true },
  },
  { _id: false },
);

const statsSchema = new mongoose.Schema(
  {
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    upvotesCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const materialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    type: { type: String, enum: materialTypes, required: true, index: true },
    file: { type: fileSchema, required: true },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'University',
      required: true,
      index: true,
    },
    campus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus',
      required: true,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    status: {
      type: String,
      enum: materialStatuses,
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    stats: { type: statsSchema, default: () => ({}) },
    popularityScore: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

materialSchema.plugin(tenantPlugin);

materialSchema.index({
  tenantId: 1,
  status: 1,
  campus: 1,
  department: 1,
  subject: 1,
  type: 1,
});
materialSchema.index({ tenantId: 1, subject: 1, createdAt: -1 });
materialSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
materialSchema.index({ tenantId: 1, status: 1, popularityScore: -1, createdAt: -1 });
materialSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Material = mongoose.model('Material', materialSchema);
