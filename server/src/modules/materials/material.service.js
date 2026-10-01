import { Material } from '../../models/Material.js';
import { University } from '../../models/University.js';
import { Campus } from '../../models/Campus.js';
import { Department } from '../../models/Department.js';
import { Course } from '../../models/Course.js';
import { Subject } from '../../models/Subject.js';
import { Tenant } from '../../models/Tenant.js';
import { AppError } from '../../utils/AppError.js';
import { storageService, SIGNED_URL_TTL_SEC } from '../../services/storage.service.js';
import { toPublicMaterial } from './material.serializer.js';
import { computePopularityScore, escapeRegex } from '../../utils/popularity.js';
import { materialTypes, PLATFORM_MAX_UPLOAD_MB } from '../../config/constants.js';
import {
  assertCanModerate,
  buildAdminScopeFilter,
  idOf,
  isOrgAdmin,
  isPlatformAdmin,
} from '../../utils/orgScope.js';
import { getTenantDoc, getTenantId } from '../../utils/tenantContext.js';
import {
  assertSafeUploadFile,
  assertWithinUploadLimit,
  tenantFolderPath,
} from '../../utils/fileValidation.js';
import mongoose from 'mongoose';

const POPULATE = [
  { path: 'uploader', select: 'fullName username' },
  { path: 'university', select: 'name slug' },
  { path: 'campus', select: 'name slug' },
  { path: 'department', select: 'name slug' },
  { path: 'course', select: 'name slug' },
  { path: 'subject', select: 'name slug' },
];

const SORT_MAP = {
  latest: { createdAt: -1 },
  popular: { popularityScore: -1, createdAt: -1 },
  top_rated: { 'stats.ratingAvg': -1, 'stats.ratingCount': -1, createdAt: -1 },
};

function applyPopularity(material) {
  material.popularityScore = computePopularityScore(material.stats);
  return material;
}

async function assertTaxonomy({ universityId, campusId, departmentId, courseId, subjectId }) {
  const [university, campus, department, course, subject] = await Promise.all([
    University.findById(universityId),
    Campus.findById(campusId),
    Department.findById(departmentId),
    Course.findById(courseId),
    Subject.findById(subjectId),
  ]);

  if (!university || !campus || !department || !course || !subject) {
    throw new AppError('Invalid org/taxonomy selection', 400, { code: 'INVALID_TAXONOMY' });
  }
  if (String(campus.university) !== String(university._id)) {
    throw new AppError('Campus does not belong to university', 400, { code: 'TAXONOMY_MISMATCH' });
  }
  if (String(department.campus) !== String(campus._id)) {
    throw new AppError('Department does not belong to campus', 400, { code: 'TAXONOMY_MISMATCH' });
  }
  if (String(course.department) !== String(department._id)) {
    throw new AppError('Course does not belong to department', 400, { code: 'TAXONOMY_MISMATCH' });
  }
  if (String(subject.course) !== String(course._id)) {
    throw new AppError('Subject does not belong to course', 400, { code: 'TAXONOMY_MISMATCH' });
  }

  return { university, campus, department, course, subject };
}

function canViewMaterial(material, user, tenantCtx = {}) {
  if (isPlatformAdmin(user) || tenantCtx.isPlatformAdmin) return true;
  if (isOrgAdmin(user) && tenantCtx.isOrgAdmin) {
    // Org admins can view materials in their moderation scope (incl. pending)
    try {
      assertCanModerate(user, material);
      return true;
    } catch {
      // fall through to campus library rules for approved
    }
  }

  const matCampus = String(material.campus?._id || material.campus || '');
  const uploaderId = String(material.uploader?._id || material.uploader || '');

  if (user) {
    if (uploaderId === String(user._id)) return true;
    const userCampus = String(user.campus?._id || user.campus || tenantCtx.campusId || '');
    return material.status === 'approved' && userCampus && matCampus === userCampus;
  }

  return (
    material.status === 'approved' &&
    tenantCtx.campusId &&
    matCampus === String(tenantCtx.campusId)
  );
}

function canModifyMaterial(material, user, tenantCtx = {}) {
  if (!user) return false;
  if (tenantCtx.isPlatformAdmin || isPlatformAdmin(user)) return true;
  if (String(material.uploader._id || material.uploader) !== String(user._id)) return false;
  const matCampus = String(material.campus?._id || material.campus || '');
  const userCampus = String(user.campus?._id || user.campus || '');
  return !userCampus || matCampus === userCampus;
}

function buildSearchFilter({
  q,
  university,
  campus,
  department,
  course,
  subject,
  type,
} = {}) {
  const filter = { status: 'approved' };

  if (university) filter.university = university;
  if (campus) filter.campus = campus;
  if (department) filter.department = department;
  if (course) filter.course = course;
  if (subject) filter.subject = subject;
  if (type && materialTypes.includes(type)) filter.type = type;

  const term = typeof q === 'string' ? q.trim() : '';
  if (term) {
    const safe = escapeRegex(term);
    filter.$or = [
      { title: { $regex: safe, $options: 'i' } },
      { description: { $regex: safe, $options: 'i' } },
      { tags: { $regex: safe, $options: 'i' } },
    ];
  }

  return filter;
}

/** // SRS-30..33 Upload — locked to student university/campus/department */
export async function uploadMaterial(user, meta, file, tenantCtx = {}) {
  if (!file) throw new AppError('File is required', 400, { code: 'NO_FILE' });

  // Never accept storage/tenant paths from the client body
  if (meta.tenantId || meta.folder || meta.publicId || meta.deliveryRef) {
    throw new AppError('Invalid upload fields', 400, { code: 'INVALID_UPLOAD_FIELDS' });
  }

  const tenantId = getTenantId() || tenantCtx.tenantId;
  if (!tenantId) {
    throw new AppError('Tenant required', 400, { code: 'TENANT_REQUIRED' });
  }

  const tenant =
    getTenantDoc() ||
    (await Tenant.findById(tenantId)) ||
    null;
  if (!tenant || tenant.deletedAt) {
    throw new AppError('University unavailable', 404, { code: 'TENANT_NOT_FOUND' });
  }
  if (tenant.status === 'suspended') {
    throw new AppError('University is suspended', 403, { code: 'TENANT_SUSPENDED' });
  }

  const maxUploadMB = Math.min(
    PLATFORM_MAX_UPLOAD_MB,
    Number(tenant.settings?.maxUploadMB) || 50,
  );
  assertWithinUploadLimit(file.size, maxUploadMB);

  const validated = await assertSafeUploadFile(file, {
    allowedMimeTypes: tenant.settings?.allowedFileTypes,
  });

  await assertStorageQuota(tenantId, tenant, file.size);

  let universityId = meta.university;
  let campusId = meta.campus;
  let departmentId = meta.department;

  if (!tenantCtx.isPlatformAdmin) {
    universityId = idOf(user.university) || tenantCtx.universityId;
    campusId = idOf(user.campus) || tenantCtx.campusId;
    departmentId = idOf(user.department) || tenantCtx.departmentId;
    if (!universityId || !campusId || !departmentId) {
      throw new AppError('University, campus, and department required', 403, {
        code: 'TENANT_REQUIRED',
      });
    }
  }

  await assertTaxonomy({
    universityId,
    campusId,
    departmentId,
    courseId: meta.course,
    subjectId: meta.subject,
  });

  // Pre-allocate material id so Cloudinary/local path uses immutable tenant+material ids
  const materialId = new mongoose.Types.ObjectId();
  const expectedFolder = tenantFolderPath(tenantId, materialId);

  const stored = await storageService.upload(
    { ...file, originalname: validated.originalName, mimetype: validated.mimeType },
    {
      tenantId: String(tenantId),
      materialId: String(materialId),
      resourceType: validated.resourceType,
      mimeType: validated.mimeType,
      originalName: validated.originalName,
    },
  );

  if (!String(stored.publicId || '').startsWith(expectedFolder)) {
    await storageService.deleteWithRetry(stored.publicId, stored.provider, {
      resourceType: stored.resourceType,
    }).catch(() => {});
    throw new AppError('Storage path mismatch', 500, { code: 'STORAGE_PATH_MISMATCH' });
  }

  let material;
  try {
    material = await Material.create({
      _id: materialId,
      title: meta.title,
      description: meta.description || '',
      type: meta.type,
      file: {
        publicId: stored.publicId,
        deliveryRef: stored.deliveryRef,
        provider: stored.provider,
        resourceType: stored.resourceType,
        mimeType: stored.mimeType,
        size: stored.bytes ?? stored.size,
        bytes: stored.bytes ?? stored.size,
        originalName: stored.originalName,
      },
      uploader: user._id,
      university: universityId,
      campus: campusId,
      department: departmentId,
      course: meta.course,
      subject: meta.subject,
      tags: meta.tags || [],
      status: 'pending',
      popularityScore: 0,
      tenantId,
    });
  } catch (err) {
    await storageService.deleteWithRetry(stored.publicId, stored.provider, {
      resourceType: stored.resourceType,
    }).catch((e) => console.error('[storage] orphan cleanup failed', e?.message));
    throw err;
  }

  await material.populate(POPULATE);
  return toPublicMaterial(material);
}

async function assertStorageQuota(tenantId, tenant, incomingBytes) {
  const quotaMB = Number(tenant.settings?.storageQuotaMB);
  if (!Number.isFinite(quotaMB) || quotaMB <= 0) return;

  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const [agg] = await Material.aggregate([
    { $match: { tenantId: tid } },
    { $group: { _id: null, used: { $sum: { $ifNull: ['$file.bytes', { $ifNull: ['$file.size', 0] }] } } } },
  ]).option({ skipTenant: true });

  const used = agg?.used || 0;
  const cap = quotaMB * 1024 * 1024;
  if (used + incomingBytes > cap) {
    throw new AppError(
      `Storage quota exceeded (${quotaMB} MB). Free space or ask your admin to raise the limit.`,
      413,
      {
        code: 'STORAGE_QUOTA_EXCEEDED',
        details: { storageQuotaMB: quotaMB, storageUsedBytes: used },
      },
    );
  }
}

/**
 * Library search — scoped to campus (students locked; guests must pick campus)
 */
export async function searchMaterials({
  page = 1,
  limit = 12,
  q,
  university,
  campus,
  department,
  course,
  subject,
  type,
  sort = 'latest',
  tenantCtx = {},
} = {}) {
  let scopedUniversity = university || null;
  let scopedCampus = campus || null;
  let scopedDepartment = department || null;

  if (tenantCtx.isPlatformAdmin) {
    scopedUniversity = university || tenantCtx.universityId || null;
    scopedCampus = campus || tenantCtx.campusId || null;
    scopedDepartment = department || tenantCtx.departmentId || null;
  } else if (tenantCtx.tenantScope === 'admin') {
    scopedUniversity = tenantCtx.universityId || university || null;
    scopedCampus = tenantCtx.campusId || campus || null;
    if (tenantCtx.adminLevel === 'department') {
      scopedDepartment = tenantCtx.departmentId;
    } else {
      scopedDepartment = department || tenantCtx.departmentId || null;
    }
  } else if (tenantCtx.tenantScope === 'tenant') {
    scopedUniversity = tenantCtx.universityId;
    scopedCampus = tenantCtx.campusId;
    scopedDepartment = department || null;
  } else if (tenantCtx.tenantScope === 'guest') {
    scopedUniversity = university || tenantCtx.universityId || null;
    scopedCampus = campus || tenantCtx.campusId || null;
    scopedDepartment = department || null;
    if (!scopedCampus) {
      return {
        items: [],
        meta: {
          page: 1,
          limit,
          total: 0,
          pages: 1,
          sort,
          q: q || '',
          filters: {
            university: scopedUniversity,
            campus: null,
            department: null,
            course: null,
            subject: null,
            type: type || null,
          },
          tenantRequired: true,
          message: 'Select a university and campus to browse the library',
        },
      };
    }
  }

  const skip = (page - 1) * limit;
  const filter = buildSearchFilter({
    q,
    university: scopedUniversity,
    campus: scopedCampus,
    department: scopedDepartment,
    course,
    subject,
    type,
  });
  const sortKey = SORT_MAP[sort] ? sort : 'latest';
  const sortSpec = SORT_MAP[sortKey];

  const [items, total] = await Promise.all([
    Material.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .populate(POPULATE)
      .lean(),
    Material.countDocuments(filter),
  ]);

  return {
    items: items.map((m) => toPublicMaterial(m)),
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      sort: sortKey,
      q: q || '',
      filters: {
        university: scopedUniversity || null,
        campus: scopedCampus || null,
        department: scopedDepartment || null,
        course: course || null,
        subject: subject || null,
        type: type || null,
      },
      tenantRequired: false,
    },
  };
}

export async function listApproved(params = {}) {
  return searchMaterials(params);
}

export async function listMine(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const filter = { uploader: userId };
  const [items, total] = await Promise.all([
    Material.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE)
      .lean(),
    Material.countDocuments(filter),
  ]);

  return {
    items: items.map((m) => toPublicMaterial(m)),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getMaterialById(id, user, tenantCtx = {}) {
  const material = await Material.findById(id).populate(POPULATE);
  if (!material) throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });
  if (!canViewMaterial(material, user, tenantCtx)) {
    throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });
  }

  if (material.status === 'approved') {
    material.stats.views += 1;
    applyPopularity(material);
    await material.save();
  }

  return toPublicMaterial(material);
}

export async function updateMaterial(id, user, input, tenantCtx = {}) {
  if (input.tenantId || input.folder || input.publicId) {
    throw new AppError('Cannot change storage or tenant fields', 400, {
      code: 'INVALID_UPDATE_FIELDS',
    });
  }
  const material = await Material.findById(id);
  if (!material) throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });
  if (!canModifyMaterial(material, user, tenantCtx)) {
    throw new AppError('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  const nextCourse = input.course || String(material.course);
  const nextSubject = input.subject || String(material.subject);
  if (input.course || input.subject) {
    await assertTaxonomy({
      universityId: String(material.university),
      campusId: String(material.campus),
      departmentId: String(material.department),
      courseId: nextCourse,
      subjectId: nextSubject,
    });
  }

  if (input.title !== undefined) material.title = input.title;
  if (input.description !== undefined) material.description = input.description;
  if (input.type !== undefined) material.type = input.type;
  if (input.course !== undefined) material.course = input.course;
  if (input.subject !== undefined) material.subject = input.subject;
  if (input.tags !== undefined) material.tags = input.tags;

  if (material.status === 'rejected') {
    material.status = 'pending';
    material.rejectionReason = '';
  }

  await material.save();
  await material.populate(POPULATE);
  return toPublicMaterial(material);
}

export async function deleteMaterial(id, user, tenantCtx = {}) {
  const material = await Material.findById(id);
  if (!material) throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });
  if (!canModifyMaterial(material, user, tenantCtx)) {
    throw new AppError('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  await storageService.deleteWithRetry(material.file.publicId, material.file.provider, {
    resourceType: material.file.resourceType,
  });
  await material.deleteOne();
}

/**
 * Tenant-checked file access → short-lived signed URL (or local stream).
 * Cross-tenant / unauthorized → 404 (do not leak existence).
 * Unapproved: uploader + in-scope moderators only.
 */
export async function getMaterialFileAccess(id, user, { countDownload = true, tenantCtx = {} } = {}) {
  if (!user) throw new AppError('Authentication required', 401, { code: 'UNAUTHORIZED' });

  const tenant = getTenantDoc();
  if (!tenant || tenant.deletedAt) {
    throw new AppError('University unavailable', 404, { code: 'TENANT_NOT_FOUND' });
  }
  if (tenant.status === 'suspended') {
    throw new AppError('University is suspended', 403, { code: 'TENANT_SUSPENDED' });
  }

  // Plugin-scoped find — wrong tenant yields null → 404
  const material = await Material.findById(id);
  if (!material) throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });

  if (!canAccessMaterialFile(material, user, tenantCtx)) {
    throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });
  }

  if (countDownload) {
    material.stats.downloads += 1;
    applyPopularity(material);
    await material.save();
  }

  const ttl = SIGNED_URL_TTL_SEC;
  if (material.file.provider === 'cloudinary') {
    const url = await storageService.getSignedUrl(material.file, ttl);
    return { mode: 'redirect', url, expiresIn: ttl, material };
  }

  return {
    mode: 'stream',
    stream: storageService.openLocalStream(material.file.publicId),
    expiresIn: ttl,
    material,
  };
}

/** File download/preview ACL (stricter than library listing for pending). */
function canAccessMaterialFile(material, user, tenantCtx = {}) {
  if (!user) return false;
  if (isPlatformAdmin(user) || tenantCtx.isPlatformAdmin) return true;

  const uploaderId = String(material.uploader?._id || material.uploader || '');
  if (uploaderId === String(user._id)) return true;

  if (isOrgAdmin(user) && tenantCtx.isOrgAdmin) {
    try {
      assertCanModerate(user, material);
      return true;
    } catch {
      return false;
    }
  }

  // Other students: approved + same campus only
  if (material.status !== 'approved') return false;
  const matCampus = String(material.campus?._id || material.campus || '');
  const userCampus = String(user.campus?._id || user.campus || tenantCtx.campusId || '');
  return Boolean(userCampus && matCampus === userCampus);
}

/** Scoped moderation — each admin only sees/approves their org uploads */
export async function moderateMaterial(id, adminUser, { status, rejectionReason }) {
  if (adminUser.role !== 'tenantAdmin') {
    throw new AppError('Forbidden', 403, { code: 'FORBIDDEN' });
  }
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const material = await Material.findById(id);
  if (!material) throw new AppError('Material not found', 404, { code: 'NOT_FOUND' });
  assertCanModerate(adminUser, material);

  material.status = status;
  material.rejectionReason =
    status === 'rejected' ? rejectionReason || 'Does not meet platform guidelines' : '';

  await material.save();
  await material.populate(POPULATE);
  return toPublicMaterial(material);
}

export async function listPending({ page = 1, limit = 20, adminUser = null } = {}) {
  const skip = (page - 1) * limit;
  const scope = adminUser ? buildAdminScopeFilter(adminUser) : { _id: null };
  const filter = { status: 'pending', ...scope };

  const [items, total] = await Promise.all([
    Material.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE)
      .lean(),
    Material.countDocuments(filter),
  ]);
  return {
    items: items.map((m) => toPublicMaterial(m)),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}
