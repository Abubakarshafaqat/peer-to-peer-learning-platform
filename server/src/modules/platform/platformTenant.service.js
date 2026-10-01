import crypto from 'crypto';
import mongoose from 'mongoose';
import { Tenant, getSignupMode } from '../../models/Tenant.js';
import { User } from '../../models/User.js';
import { Material } from '../../models/Material.js';
import { AppError } from '../../utils/AppError.js';
import { invalidateTenantCache } from '../../utils/tenantCache.js';
import { revokeRefreshTokensForTenant } from '../auth/auth.service.js';
import { writeAudit, clientIp } from '../../utils/audit.js';
import { hashPassword, hashOtp } from '../../utils/password.js';
import { env } from '../../config/env.js';
import {
  TENANT_SLUG_RE,
  RESERVED_TENANT_SLUGS,
  HEX_COLOR_RE,
  SAFE_UPLOAD_MIME_TYPES,
  PLATFORM_MAX_UPLOAD_MB,
} from '../../config/constants.js';
import { runWithTenantContext } from '../../utils/tenantContext.js';

function assertSlug(slug) {
  const s = String(slug || '')
    .trim()
    .toLowerCase();
  if (!TENANT_SLUG_RE.test(s)) {
    throw new AppError('Invalid tenant slug', 400, { code: 'TENANT_SLUG_INVALID' });
  }
  if (RESERVED_TENANT_SLUGS.has(s)) {
    throw new AppError('Slug is reserved', 400, { code: 'TENANT_SLUG_RESERVED' });
  }
  return s;
}

export function toPublicTenant(doc, { includeSettings = true } = {}) {
  const t = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const out = {
    id: String(t._id),
    name: t.name,
    slug: t.slug,
    domainWhitelist: t.domainWhitelist || [],
    signupMode: getSignupMode(t),
    logoUrl: t.logoUrl || '',
    theme: { primaryColor: t.theme?.primaryColor || '#0f766e' },
    status: t.status,
    deletedAt: t.deletedAt || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
  if (includeSettings) {
    out.settings = {
      maxUploadMB: t.settings?.maxUploadMB ?? 50,
      allowedFileTypes: t.settings?.allowedFileTypes || [...SAFE_UPLOAD_MIME_TYPES],
      moderationEnabled: t.settings?.moderationEnabled !== false,
      storageQuotaMB: t.settings?.storageQuotaMB ?? null,
    };
  }
  return out;
}

export async function listTenants({ includeDeleted = false } = {}) {
  const filter = includeDeleted ? {} : { deletedAt: null };
  const items = await Tenant.find(filter).sort({ createdAt: -1 }).lean();
  return items.map((t) => toPublicTenant(t));
}

export async function getTenant(id) {
  const tenant = await Tenant.findById(id);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);
  return toPublicTenant(tenant);
}

/**
 * Create tenant. Optionally bootstrap first tenantAdmin with password-setup link
 * (never returns a password).
 */
export async function createTenant(input, actor, req) {
  const slug = assertSlug(input.slug);
  const existing = await Tenant.findOne({ slug });
  if (existing) {
    throw new AppError('Slug already in use', 409, { code: 'TENANT_SLUG_TAKEN' });
  }

  const domainWhitelist = (input.domainWhitelist || [])
    .map((d) => String(d).trim().toLowerCase())
    .filter(Boolean);

  let signupMode = input.signupMode;
  if (!signupMode) {
    signupMode = domainWhitelist.length ? 'domain' : 'invite';
  }
  if (!['domain', 'invite', 'both', 'closed'].includes(signupMode)) {
    throw new AppError('Invalid signupMode', 400);
  }

  const primaryColor = input.theme?.primaryColor || '#0f766e';
  if (!HEX_COLOR_RE.test(primaryColor)) {
    throw new AppError('theme.primaryColor must be #RRGGBB', 400, { code: 'INVALID_COLOR' });
  }

  const tenant = await Tenant.create({
    name: String(input.name || '').trim(),
    slug,
    domainWhitelist,
    signupMode,
    logoUrl: input.logoUrl || '',
    theme: { primaryColor },
    status: 'active',
    settings: {
      maxUploadMB: Math.min(
        PLATFORM_MAX_UPLOAD_MB,
        Math.max(1, Number(input.settings?.maxUploadMB) || 50),
      ),
      allowedFileTypes: sanitizeFileTypes(input.settings?.allowedFileTypes),
      moderationEnabled: input.settings?.moderationEnabled !== false,
      storageQuotaMB:
        input.settings?.storageQuotaMB != null && Number(input.settings.storageQuotaMB) > 0
          ? Number(input.settings.storageQuotaMB)
          : null,
    },
  });

  let firstAdmin = null;
  if (input.firstAdmin?.email) {
    firstAdmin = await createFirstTenantAdmin(tenant, input.firstAdmin);
  }

  await writeAudit({
    actor,
    role: actor?.role,
    tenantId: tenant._id,
    action: 'tenant.create',
    target: { type: 'tenant', id: tenant._id, label: tenant.slug },
    meta: { signupMode, hasFirstAdmin: Boolean(firstAdmin) },
    ip: clientIp(req),
  });

  return {
    tenant: toPublicTenant(tenant),
    firstAdmin,
  };
}

async function createFirstTenantAdmin(tenant, adminInput) {
  const email = String(adminInput.email).trim().toLowerCase();
  const username = String(adminInput.username || email.split('@')[0])
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 32);
  const fullName = String(adminInput.fullName || 'Tenant Admin').trim();

  const setupToken = crypto.randomBytes(32).toString('hex');
  const setupHash = await hashOtp(setupToken);
  // Temporary unusable hash until they set password
  const passwordHash = await hashPassword(crypto.randomBytes(24).toString('base64url'));

  const user = await runWithTenantContext({ tenantId: tenant._id, tenant }, async () =>
    User.create({
      fullName,
      username: username.length >= 3 ? username : `admin_${slugSafe(tenant.slug)}`.slice(0, 32),
      email,
      passwordHash,
      role: 'tenantAdmin',
      adminLevel: 'university',
      tenantId: tenant._id,
      emailVerified: true,
      passwordSetup: {
        hash: setupHash,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    }),
  );

  const setupUrl = `${env.CLIENT_URL}/set-password?token=${encodeURIComponent(setupToken)}&email=${encodeURIComponent(email)}&tenant=${encodeURIComponent(tenant.slug)}`;

  return {
    id: String(user._id),
    email: user.email,
    username: user.username,
    setupUrl,
    // never return password or raw token elsewhere in logs
  };
}

function slugSafe(s) {
  return String(s).replace(/[^a-z0-9]/g, '').slice(0, 20) || 'tenant';
}

export async function updateTenant(id, input, actor, req) {
  const tenant = await Tenant.findById(id);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

  if (Object.prototype.hasOwnProperty.call(input, 'slug') && input.slug !== tenant.slug) {
    throw new AppError('Slug is immutable', 400, { code: 'SLUG_IMMUTABLE' });
  }

  if (input.name != null) tenant.name = String(input.name).trim();
  if (input.logoUrl != null) tenant.logoUrl = String(input.logoUrl);
  if (input.theme?.primaryColor != null) {
    if (!HEX_COLOR_RE.test(input.theme.primaryColor)) {
      throw new AppError('theme.primaryColor must be #RRGGBB', 400, { code: 'INVALID_COLOR' });
    }
    tenant.theme = tenant.theme || {};
    tenant.theme.primaryColor = input.theme.primaryColor;
  }
  if (Array.isArray(input.domainWhitelist)) {
    tenant.domainWhitelist = input.domainWhitelist
      .map((d) => String(d).trim().toLowerCase())
      .filter(Boolean);
  }
  if (input.signupMode) {
    if (!['domain', 'invite', 'both', 'closed'].includes(input.signupMode)) {
      throw new AppError('Invalid signupMode', 400);
    }
    tenant.signupMode = input.signupMode;
  }
  if (input.settings) {
    applyPlatformSettings(tenant, input.settings);
  }

  await tenant.save();
  invalidateTenantCache(tenant.slug);

  await writeAudit({
    actor,
    role: actor?.role,
    tenantId: tenant._id,
    action: 'tenant.update',
    target: { type: 'tenant', id: tenant._id, label: tenant.slug },
    ip: clientIp(req),
  });

  return toPublicTenant(tenant);
}

function applyPlatformSettings(tenant, settings) {
  if (settings.maxUploadMB != null) {
    const n = Number(settings.maxUploadMB);
    if (!Number.isFinite(n) || n < 1 || n > PLATFORM_MAX_UPLOAD_MB) {
      throw new AppError(`maxUploadMB must be 1–${PLATFORM_MAX_UPLOAD_MB}`, 400, {
        code: 'INVALID_UPLOAD_LIMIT',
      });
    }
    tenant.settings.maxUploadMB = n;
  }
  if (settings.allowedFileTypes != null) {
    tenant.settings.allowedFileTypes = sanitizeFileTypes(settings.allowedFileTypes);
  }
  if (settings.moderationEnabled != null) {
    tenant.settings.moderationEnabled = Boolean(settings.moderationEnabled);
  }
  if (settings.storageQuotaMB !== undefined) {
    if (settings.storageQuotaMB === null || settings.storageQuotaMB === '') {
      tenant.settings.storageQuotaMB = null;
    } else {
      const q = Number(settings.storageQuotaMB);
      if (!Number.isFinite(q) || q < 0) {
        throw new AppError('storageQuotaMB must be >= 0 or null', 400, {
          code: 'INVALID_STORAGE_QUOTA',
        });
      }
      tenant.settings.storageQuotaMB = q === 0 ? null : q;
    }
  }
}

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

export async function setTenantStatus(id, status, actor, req) {
  if (!['active', 'suspended'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }
  const tenant = await Tenant.findById(id);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

  tenant.status = status;
  await tenant.save();
  invalidateTenantCache(tenant.slug);

  if (status === 'suspended') {
    await revokeRefreshTokensForTenant(tenant._id);
  }

  await writeAudit({
    actor,
    role: actor?.role,
    tenantId: tenant._id,
    action: status === 'suspended' ? 'tenant.suspend' : 'tenant.activate',
    target: { type: 'tenant', id: tenant._id, label: tenant.slug },
    ip: clientIp(req),
  });

  return toPublicTenant(tenant);
}

export async function softDeleteTenant(id, actor, req) {
  const tenant = await Tenant.findById(id);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

  tenant.deletedAt = new Date();
  tenant.status = 'suspended';
  await tenant.save();
  invalidateTenantCache(tenant.slug);
  await revokeRefreshTokensForTenant(tenant._id);

  await writeAudit({
    actor,
    role: actor?.role,
    tenantId: tenant._id,
    action: 'tenant.soft_delete',
    target: { type: 'tenant', id: tenant._id, label: tenant.slug },
    ip: clientIp(req),
  });

  return toPublicTenant(tenant);
}

export async function setSignupMode(id, signupMode, actor, req) {
  if (!['domain', 'invite', 'both', 'closed'].includes(signupMode)) {
    throw new AppError('Invalid signupMode', 400);
  }
  const tenant = await Tenant.findById(id);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);
  tenant.signupMode = signupMode;
  await tenant.save();
  invalidateTenantCache(tenant.slug);

  await writeAudit({
    actor,
    role: actor?.role,
    tenantId: tenant._id,
    action: 'tenant.signup_mode',
    target: { type: 'tenant', id: tenant._id, label: tenant.slug },
    meta: { signupMode },
    ip: clientIp(req),
  });

  return toPublicTenant(tenant);
}

/** Per-tenant stats via aggregation with explicit tenantId grouping */
export async function tenantStats(tenantId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const tenant = await Tenant.findById(tid);
  if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

  const since = new Date(Date.now() - 30 * 86400000);

  const [userCount, materialAgg, signupsLast30Days] = await Promise.all([
    User.countDocuments({ tenantId: tid }).setOptions({ skipTenant: true }),
    Material.aggregate([
      { $match: { tenantId: tid } },
      {
        $group: {
          _id: '$tenantId',
          materialCount: { $sum: 1 },
          storageUsedBytes: { $sum: { $ifNull: ['$file.bytes', { $ifNull: ['$file.size', 0] }] } },
        },
      },
    ]).option({ skipTenant: true }),
    User.countDocuments({
      tenantId: tid,
      createdAt: { $gte: since },
    }).setOptions({ skipTenant: true }),
  ]);

  const mat = materialAgg[0] || { materialCount: 0, storageUsedBytes: 0 };

  return {
    tenantId: String(tid),
    slug: tenant.slug,
    userCount,
    materialCount: mat.materialCount,
    storageUsedBytes: mat.storageUsedBytes,
    storageQuotaMB: tenant.settings?.storageQuotaMB ?? null,
    signupsLast30Days,
  };
}

export async function platformOverviewStats() {
  const [tenants, users, materials, storage] = await Promise.all([
    Tenant.countDocuments({ deletedAt: null }),
    User.countDocuments({}).setOptions({ skipTenant: true }),
    Material.countDocuments({}).setOptions({ skipTenant: true }),
    Material.aggregate([
      {
        $group: {
          _id: '$tenantId',
          bytes: { $sum: { $ifNull: ['$file.size', 0] } },
          materials: { $sum: 1 },
        },
      },
    ]).option({ skipTenant: true }),
  ]);

  return {
    tenants,
    users,
    materials,
    byTenant: storage.map((r) => ({
      tenantId: r._id ? String(r._id) : null,
      storageUsedBytes: r.bytes,
      materialCount: r.materials,
    })),
  };
}

export { sanitizeFileTypes, applyPlatformSettings, HEX_COLOR_RE, PLATFORM_MAX_UPLOAD_MB };
