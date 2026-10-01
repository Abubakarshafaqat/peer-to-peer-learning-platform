import { AppError } from '../utils/AppError.js';

function isTenantAdminRole(user) {
  return user?.role === 'tenantAdmin';
}

/**
 * Inside-tenant moderation scope for tenantAdmin.
 * superadmin is platform-level only when explicitly allowed on a route.
 */
export function getAdminLevel(user) {
  if (!user) return null;
  if (user.role === 'superadmin') return 'platform';
  if (!isTenantAdminRole(user)) return null;
  return user.adminLevel || 'department';
}

export function isPlatformAdmin(user) {
  return user?.role === 'superadmin' || getAdminLevel(user) === 'platform';
}

export function isOrgAdmin(user) {
  return isTenantAdminRole(user) || user?.role === 'superadmin';
}

/** Mongo filter for pending/moderation queues based on admin scope */
export function buildAdminScopeFilter(admin) {
  const level = getAdminLevel(admin);
  if (!level) return { _id: null };

  if (level === 'platform') return {};
  if (level === 'university' && admin.university) {
    return { university: admin.university._id || admin.university };
  }
  if (level === 'campus' && admin.campus) {
    return { campus: admin.campus._id || admin.campus };
  }
  if (level === 'department' && admin.department) {
    return { department: admin.department._id || admin.department };
  }
  return { _id: null };
}

/** Whether an admin may moderate this material */
export function canModerateMaterial(admin, material) {
  const level = getAdminLevel(admin);
  if (!level) return false;
  if (level === 'platform') return true;

  const matUni = String(material.university?._id || material.university || '');
  const matCampus = String(material.campus?._id || material.campus || '');
  const matDept = String(material.department?._id || material.department || '');

  if (level === 'university') {
    return matUni === String(admin.university?._id || admin.university || '');
  }
  if (level === 'campus') {
    return matCampus === String(admin.campus?._id || admin.campus || '');
  }
  if (level === 'department') {
    return matDept === String(admin.department?._id || admin.department || '');
  }
  return false;
}

export function assertCanModerate(admin, material) {
  if (!canModerateMaterial(admin, material)) {
    throw new AppError('Outside your moderation scope', 403, { code: 'SCOPE_FORBIDDEN' });
  }
}

export function idOf(ref) {
  if (!ref) return null;
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}
