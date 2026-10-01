export function toPublicMaterial(doc, { includeFileMeta = true } = {}) {
  const m = typeof doc.toObject === 'function' ? doc.toObject() : doc;

  const ref = (val) => {
    if (!val) return null;
    if (typeof val === 'object' && val._id) {
      return {
        id: String(val._id),
        name: val.name,
        slug: val.slug,
        username: val.username,
        fullName: val.fullName,
      };
    }
    return { id: String(val) };
  };

  return {
    id: String(m._id),
    title: m.title,
    description: m.description,
    type: m.type,
    tags: m.tags || [],
    status: m.status,
    rejectionReason: m.rejectionReason || '',
    university: ref(m.university),
    campus: ref(m.campus),
    department: ref(m.department),
    course: ref(m.course),
    subject: ref(m.subject),
    uploader: ref(m.uploader),
    stats: m.stats || {},
    popularityScore: m.popularityScore || 0,
    file: includeFileMeta
      ? {
          mimeType: m.file?.mimeType,
          size: m.file?.bytes ?? m.file?.size,
          bytes: m.file?.bytes ?? m.file?.size,
          resourceType: m.file?.resourceType,
          originalName: m.file?.originalName,
          provider: m.file?.provider,
        }
      : undefined,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}
