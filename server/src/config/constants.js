/**
 * Popularity score weights — used by M3 search/sort (SRS-54..72).
 * popularityScore = views*wV + downloads*wD + likes*wL + upvotes*wU
 */
export const popularityWeights = {
  views: 1,
  downloads: 3,
  likes: 2,
  upvotes: 4,
};

export const materialTypes = [
  'notes',
  'past_paper',
  'mcq',
  'short_questions',
  'long_questions',
  'other',
];

export const userRoles = ['student', 'tenantAdmin', 'superadmin'];

/**
 * Inside-tenant moderation scope for tenantAdmin.
 * superadmin uses null / no adminLevel.
 */
export const adminLevels = ['platform', 'university', 'campus', 'department'];

export const materialStatuses = ['pending', 'approved', 'rejected'];

export const difficulties = ['easy', 'medium', 'hard'];

export const TENANT_SLUG_RE = /^[a-z0-9-]{2,40}$/;

export const RESERVED_TENANT_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'platform',
  'app',
  'static',
]);

/** Hex color #RRGGBB */
export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/** Safe MIME allowlist for tenant settings.allowedFileTypes */
export const SAFE_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Platform cap for tenant maxUploadMB (tenant admins cannot exceed) */
export const PLATFORM_MAX_UPLOAD_MB = 500;
