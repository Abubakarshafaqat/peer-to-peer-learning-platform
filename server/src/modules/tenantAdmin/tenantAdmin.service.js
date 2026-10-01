import { Tenant } from '../../models/Tenant.js';
import { User } from '../../models/User.js';
import { Material } from '../../models/Material.js';
import { AuditLog } from '../../models/AuditLog.js';
import { AppError } from '../../utils/AppError.js';
import { invalidateTenantCache } from '../../utils/tenantCache.js';
import { writeAudit, clientIp } from '../../utils/audit.js';
import { getAdminLevel, idOf, buildAdminScopeFilter, assertCanModerate } from '../../utils/orgScope.js';
import {
  HEX_COLOR_RE,
  SAFE_UPLOAD_MIME_TYPES,
  PLATFORM_MAX_UPLOAD_MB,
} from '../../config/constants.js';
import { toPublicTenant } from '../platform/platformTenant.service.js';
import { toPublicUser } from '../auth/auth.serializer.js';
import { toPublicMaterial } from '../materials/material.serializer.js';
import { revokeRefreshTokensForUser } from '../auth/auth.service.js';
import mongoose from 'mongoose';

function sanitizeFileTypes(list) {
  if (!list) return [...SAFE_UPLOAD_MIME_TYPES];
  const allowed = new Set(SAFE_UPLOAD_MIME_TYPES);
  const next = [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  for (const t of next) {
    if (!allowed.has(t)) {
      throw new AppError(`File type not allowed: ${t}`, 400, { code: 'INVALID_FILE_TYPE' });
    }
  }
  return next.length ? next : [...SAFE_UPLOAD_MIME_TYPES];
}

export async function getOwnTenant(req) {
  const tenant = req.tenant;
  return toPublicTenant(tenant, { includeSettings: true });
}

/**
 * Tenant admins may edit branding + safe settings only.
 * Cannot change slug, status, plan, domainWhitelist.
 */
export async function patchOwnTenant(req, body) {
  const tenant = await Tenant.findById(req.tenant._id);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

  const forbidden = ['slug', 'status', 'domainWhitelist', 'signupMode', 'plan', 'deletedAt'];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      throw new AppError(`Cannot change ${key}`, 403, { code: 'FORBIDDEN_FIELD' });
    }
  }

  if (body.name != null) tenant.name = String(body.name).trim().slice(0, 160);
  if (body.logoUrl != null) tenant.logoUrl = String(body.logoUrl);

  if (body.theme?.primaryColor != null) {
    if (!HEX_COLOR_RE.test(body.theme.primaryColor)) {
      throw new AppError('theme.primaryColor must be #RRGGBB', 400, { code: 'INVALID_COLOR' });
    }
    tenant.theme = tenant.theme || {};
    tenant.theme.primaryColor = body.theme.primaryColor;
  }

  if (body.settings) {
    if (body.settings.maxUploadMB != null) {
      const n = Number(body.settings.maxUploadMB);
      if (!Number.isFinite(n) || n < 1 || n > PLATFORM_MAX_UPLOAD_MB) {
        throw new AppError(`maxUploadMB must be 1–${PLATFORM_MAX_UPLOAD_MB}`, 400, {
          code: 'INVALID_UPLOAD_LIMIT',
        });
      }
      tenant.settings.maxUploadMB = n;
    }
    if (body.settings.allowedFileTypes != null) {
      tenant.settings.allowedFileTypes = sanitizeFileTypes(body.settings.allowedFileTypes);
    }
    if (body.settings.moderationEnabled != null) {
      tenant.settings.moderationEnabled = Boolean(body.settings.moderationEnabled);
    }
    if (body.settings.storageQuotaMB !== undefined) {
      if (body.settings.storageQuotaMB === null || body.settings.storageQuotaMB === '') {
        tenant.settings.storageQuotaMB = null;
      } else {
        const q = Number(body.settings.storageQuotaMB);
        if (!Number.isFinite(q) || q < 0) {
          throw new AppError('storageQuotaMB must be >= 0 or null', 400, {
            code: 'INVALID_STORAGE_QUOTA',
          });
        }
        tenant.settings.storageQuotaMB = q === 0 ? null : q;
      }
    }
  }

  await tenant.save();
  invalidateTenantCache(tenant.slug);

  await writeAudit({
    actor: req.user,
    role: req.user.role,
    tenantId: tenant._id,
    action: 'tenant.settings_update',
    target: { type: 'tenant', id: tenant._id, label: tenant.slug },
    ip: clientIp(req),
  });

  // refresh req.tenant
  req.tenant = tenant;
  return toPublicTenant(tenant);
}

function userScopeFilter(admin) {
  const level = getAdminLevel(admin);
  if (!level || level === 'university' || level === 'platform') return {};
  if (level === 'campus' && admin.campus) {
    return { campus: idOf(admin.campus) };
  }
  if (level === 'department' && admin.department) {
    return { department: idOf(admin.department) };
  }
  return { _id: null };
}

export async function listUsers(req, { q = '', page = 1, limit = 20 } = {}) {
  const filter = { ...userScopeFilter(req.user) };
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ email: re }, { username: re }, { fullName: re }];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
      { path: 'campus', select: 'name slug' },
      { path: 'department', select: 'name slug' },
    ]),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((u) => toPublicUser(u)),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function setUserActive(req, userId, isActive) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  assertUserInScope(req.user, user);

  user.isActive = Boolean(isActive);
  await user.save();

  // Kill refresh sessions so deactivated users cannot mint new access tokens
  if (!user.isActive) {
    await revokeRefreshTokensForUser(user._id);
  }

  await writeAudit({
    actor: req.user,
    role: req.user.role,
    tenantId: req.tenant._id,
    action: isActive ? 'user.reactivate' : 'user.deactivate',
    target: { type: 'user', id: user._id, label: user.email },
    ip: clientIp(req),
  });

  return toPublicUser(user);
}

export async function changeUserRole(req, userId, { role, adminLevel }) {
  if (!['student', 'tenantAdmin'].includes(role)) {
    throw new AppError('Role must be student or tenantAdmin', 400, { code: 'INVALID_ROLE' });
  }
  if (role === 'superadmin') {
    throw new AppError('Cannot grant superadmin', 403, { code: 'FORBIDDEN_ROLE' });
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  assertUserInScope(req.user, user);

  const prevRole = user.role;
  const prevLevel = user.adminLevel;
  const actorLevel = getAdminLevel(req.user);
  if (role === 'tenantAdmin') {
    const nextLevel = adminLevel || 'department';
    if (!['university', 'campus', 'department'].includes(nextLevel)) {
      throw new AppError('Invalid adminLevel', 400);
    }
    // Actor must not grant a broader scope than they have
    if (!canGrantLevel(actorLevel, nextLevel)) {
      throw new AppError('Cannot grant that adminLevel', 403, { code: 'SCOPE_FORBIDDEN' });
    }
    user.role = 'tenantAdmin';
    user.adminLevel = nextLevel;
  } else {
    // demoting to student
    if (user.role === 'tenantAdmin') {
      const remaining = await User.countDocuments({
        role: 'tenantAdmin',
        _id: { $ne: user._id },
        isActive: true,
      });
      if (remaining < 1) {
        throw new AppError('Cannot demote the last tenantAdmin', 403, {
          code: 'LAST_ADMIN',
        });
      }
    }
    user.role = 'student';
    user.adminLevel = undefined;
  }

  await user.save();

  // Role / adminLevel change → force re-login (stale JWT claims must not linger via refresh)
  if (prevRole !== user.role || String(prevLevel || '') !== String(user.adminLevel || '')) {
    await revokeRefreshTokensForUser(user._id);
  }

  await writeAudit({
    actor: req.user,
    role: req.user.role,
    tenantId: req.tenant._id,
    action: 'user.role_change',
    target: { type: 'user', id: user._id, label: user.email },
    meta: { role: user.role, adminLevel: user.adminLevel || null },
    ip: clientIp(req),
  });

  return toPublicUser(user);
}

function canGrantLevel(actorLevel, targetLevel) {
  const rank = { platform: 4, university: 3, campus: 2, department: 1 };
  return (rank[actorLevel] || 0) >= (rank[targetLevel] || 0);
}

function assertUserInScope(admin, user) {
  const level = getAdminLevel(admin);
  if (!level || level === 'university' || level === 'platform') return;
  if (level === 'campus') {
    if (idOf(user.campus) !== idOf(admin.campus)) {
      throw new AppError('User outside your scope', 403, { code: 'SCOPE_FORBIDDEN' });
    }
    return;
  }
  if (level === 'department') {
    if (idOf(user.department) !== idOf(admin.department)) {
      throw new AppError('User outside your scope', 403, { code: 'SCOPE_FORBIDDEN' });
    }
  }
}

export async function listPending(req, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const scope = buildAdminScopeFilter(req.user);
  const filter = { status: 'pending', ...scope };
  const [items, total] = await Promise.all([
    Material.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'uploader', select: 'fullName username' },
        { path: 'campus', select: 'name slug' },
        { path: 'department', select: 'name slug' },
        { path: 'course', select: 'name slug' },
        { path: 'subject', select: 'name slug' },
      ]),
    Material.countDocuments(filter),
  ]);
  return {
    items: items.map((m) => toPublicMaterial(m)),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function moderate(req, materialId, { status, rejectionReason }) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }
  const material = await Material.findById(materialId);
  if (!material) throw new AppError('Material not found', 404);
  assertCanModerate(req.user, material);

  material.status = status;
  material.rejectionReason =
    status === 'rejected' ? rejectionReason || 'Does not meet platform guidelines' : '';
  await material.save();

  await writeAudit({
    actor: req.user,
    role: req.user.role,
    tenantId: req.tenant._id,
    action: status === 'approved' ? 'moderation.approve' : 'moderation.reject',
    target: { type: 'material', id: material._id, label: material.title },
    meta: status === 'rejected' ? { hasReason: Boolean(rejectionReason) } : undefined,
    ip: clientIp(req),
  });

  return toPublicMaterial(material);
}

export async function listAuditLogs(req, { page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  // Always pin to the resolved tenant ObjectId — never null / other tenants
  const tenantObjectId = new mongoose.Types.ObjectId(String(req.tenant._id));
  const filter = { tenantId: tenantObjectId };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: items.map((a) => ({
      id: String(a._id),
      actor: a.actor ? String(a.actor) : null,
      role: a.role,
      action: a.action,
      target: a.target,
      meta: a.meta,
      ip: a.ip,
      createdAt: a.createdAt,
    })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}
