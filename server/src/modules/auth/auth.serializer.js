/**
 * Serialize user for API responses (never include secrets).
 */
export function toPublicUser(user) {
  const doc = typeof user.toObject === 'function' ? user.toObject() : user;
  let university = null;
  if (doc.university) {
    if (typeof doc.university === 'object' && doc.university._id) {
      university = {
        id: String(doc.university._id),
        name: doc.university.name,
        slug: doc.university.slug,
      };
    } else {
      university = String(doc.university);
    }
  }

  return {
    id: String(doc._id),
    fullName: doc.fullName,
    username: doc.username,
    email: doc.email,
    phone: doc.phone || '',
    role: doc.role,
    avatarUrl: doc.avatarUrl || '',
    university,
    isActive: doc.isActive,
    awayMode: doc.awayMode || { enabled: false, until: null },
    lastSeenAt: doc.lastSeenAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
