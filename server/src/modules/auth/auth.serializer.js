/**
 * Serialize user for API responses (never include secrets).
 */
function serializeRef(doc) {
  if (!doc) return null;
  if (typeof doc === 'object' && doc._id) {
    return {
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
    };
  }
  return String(doc);
}

export function toPublicUser(user) {
  const doc = typeof user.toObject === 'function' ? user.toObject() : user;
  const role = doc.role;
  const tenantId = doc.tenantId
    ? typeof doc.tenantId === 'object' && doc.tenantId._id
      ? String(doc.tenantId._id)
      : String(doc.tenantId)
    : null;

  return {
    id: String(doc._id),
    fullName: doc.fullName,
    username: doc.username,
    email: doc.email,
    phone: doc.phone || '',
    role,
    adminLevel: role === 'tenantAdmin' ? doc.adminLevel || null : null,
    tenantId,
    avatarUrl: doc.avatarUrl || '',
    bio: doc.bio || '',
    city: doc.city || '',
    country: doc.country || '',
    program: doc.program || '',
    semester: doc.semester || '',
    gender: doc.gender || '',
    dateOfBirth: doc.dateOfBirth || null,
    linkedinUrl: doc.linkedinUrl || '',
    websiteUrl: doc.websiteUrl || '',
    university: serializeRef(doc.university),
    campus: serializeRef(doc.campus),
    department: serializeRef(doc.department),
    isActive: doc.isActive,
    emailVerified: Boolean(doc.emailVerified),
    awayMode: doc.awayMode || { enabled: false, until: null },
    lastSeenAt: doc.lastSeenAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
