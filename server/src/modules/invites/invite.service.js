import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Invite } from '../../models/Invite.js';
import { Campus } from '../../models/Campus.js';
import { Department } from '../../models/Department.js';
import { AppError } from '../../utils/AppError.js';
import { getAdminLevel, idOf } from '../../utils/orgScope.js';
import { getTenantId } from '../../utils/tenantContext.js';

const CODE_BYTES = 16; // 128-bit

export function generateInviteCode() {
  return crypto.randomBytes(CODE_BYTES).toString('base64url');
}

export async function hashInviteCode(plain) {
  return bcrypt.hash(String(plain), 10);
}

export async function findInviteByPlainCode(plain, { includeInactive = false } = {}) {
  const code = String(plain || '').trim();
  if (!code) return null;

  const filter = includeInactive
    ? {}
    : {
        revokedAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        $expr: { $lt: ['$usedCount', '$maxUses'] },
      };

  const candidates = await Invite.find(filter).limit(200);

  for (const inv of candidates) {
    if (await bcrypt.compare(code, inv.codeHash)) return inv;
  }
  return null;
}

/**
 * Atomically redeem: usedCount < maxUses, not expired, not revoked.
 * Returns updated invite or null if redemption failed.
 */
export async function redeemInviteAtomic(inviteId) {
  const now = new Date();
  return Invite.findOneAndUpdate(
    {
      _id: inviteId,
      revokedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      $expr: { $lt: ['$usedCount', '$maxUses'] },
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
}

function assertInviteInAdminScope(admin, inviteOrPayload) {
  const level = getAdminLevel(admin);
  if (!level || level === 'platform' || level === 'university') return;

  const campusId = idOf(inviteOrPayload.campus);
  const deptId = idOf(inviteOrPayload.department);
  const adminCampus = idOf(admin.campus);
  const adminDept = idOf(admin.department);

  if (level === 'campus') {
    if (!adminCampus) {
      throw new AppError('Campus scope required', 403, { code: 'SCOPE_FORBIDDEN' });
    }
    if (campusId && campusId !== adminCampus) {
      throw new AppError('Invite campus outside your scope', 403, { code: 'SCOPE_FORBIDDEN' });
    }
    return;
  }

  if (level === 'department') {
    if (!adminDept) {
      throw new AppError('Department scope required', 403, { code: 'SCOPE_FORBIDDEN' });
    }
    if (deptId && deptId !== adminDept) {
      throw new AppError('Invite department outside your scope', 403, { code: 'SCOPE_FORBIDDEN' });
    }
    if (campusId && adminCampus && campusId !== adminCampus) {
      throw new AppError('Invite campus outside your scope', 403, { code: 'SCOPE_FORBIDDEN' });
    }
  }
}

export async function createInvite(admin, input = {}) {
  if (admin.role !== 'tenantAdmin' && admin.role !== 'superadmin') {
    throw new AppError('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  const maxUses = Math.max(1, Number(input.maxUses) || 1);
  let expiresAt = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new AppError('expiresAt must be a future date', 400, { code: 'INVALID_EXPIRY' });
    }
  } else if (input.expiresInDays != null) {
    const days = Number(input.expiresInDays);
    if (!Number.isFinite(days) || days <= 0) {
      throw new AppError('expiresInDays must be positive', 400);
    }
    expiresAt = new Date(Date.now() + days * 86400000);
  }

  let campus = input.campus || null;
  let department = input.department || null;

  // Default scope from admin when not provided
  const level = getAdminLevel(admin);
  if (!campus && (level === 'campus' || level === 'department')) {
    campus = idOf(admin.campus);
  }
  if (!department && level === 'department') {
    department = idOf(admin.department);
  }

  if (campus) {
    const c = await Campus.findById(campus);
    if (!c || c.isActive === false) {
      throw new AppError('Invalid campus', 400, { code: 'INVALID_TENANT' });
    }
  }
  if (department) {
    const d = await Department.findById(department);
    if (!d || d.isActive === false) {
      throw new AppError('Invalid department', 400, { code: 'INVALID_TENANT' });
    }
    if (campus && String(d.campus) !== String(campus)) {
      throw new AppError('Department does not belong to campus', 400, { code: 'INVALID_TENANT' });
    }
  }

  assertInviteInAdminScope(admin, { campus, department });

  const plain = generateInviteCode();
  const codeHash = await hashInviteCode(plain);
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new AppError('Tenant context required to create invite', 400, {
      code: 'TENANT_REQUIRED',
    });
  }

  const invite = await Invite.create({
    codeHash,
    role: 'student',
    campus: campus || null,
    department: department || null,
    maxUses,
    usedCount: 0,
    expiresAt,
    createdBy: admin._id,
    revokedAt: null,
    tenantId,
  });

  return { invite, plainCode: plain };
}

export async function listInvites(admin, { includeRevoked = false } = {}) {
  const filter = {};
  if (!includeRevoked) filter.revokedAt = null;

  const level = getAdminLevel(admin);
  if (level === 'campus' && admin.campus) {
    filter.campus = idOf(admin.campus);
  } else if (level === 'department' && admin.department) {
    filter.department = idOf(admin.department);
  }

  const items = await Invite.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return items.map(toPublicInvite);
}

export async function revokeInvite(admin, inviteId) {
  const invite = await Invite.findById(inviteId);
  if (!invite) throw new AppError('Invite not found', 404, { code: 'NOT_FOUND' });
  assertInviteInAdminScope(admin, invite);
  if (invite.revokedAt) return toPublicInvite(invite);
  invite.revokedAt = new Date();
  await invite.save();
  return toPublicInvite(invite);
}

export function toPublicInvite(doc) {
  const d = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(d._id),
    role: d.role,
    campus: d.campus ? String(d.campus._id || d.campus) : null,
    department: d.department ? String(d.department._id || d.department) : null,
    maxUses: d.maxUses,
    usedCount: d.usedCount,
    expiresAt: d.expiresAt || null,
    revokedAt: d.revokedAt || null,
    createdBy: d.createdBy ? String(d.createdBy._id || d.createdBy) : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
