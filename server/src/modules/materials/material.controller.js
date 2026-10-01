import { sendSuccess } from '../../utils/apiResponse.js';
import * as materialService from './material.service.js';
import { createMaterialMetaSchema, updateMaterialSchema } from './material.validation.js';
import { AppError } from '../../utils/AppError.js';

function parsePage(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
  return { page, limit };
}

function tenantCtx(req) {
  return {
    tenantId: req.tenantId || null,
    universityId: req.universityId || null,
    campusId: req.campusId || null,
    departmentId: req.departmentId || null,
    isPlatformAdmin: Boolean(req.isPlatformAdmin),
    isOrgAdmin: Boolean(req.isOrgAdmin),
    adminLevel: req.adminLevel || null,
    tenantScope: req.tenantScope || 'guest',
  };
}

// SRS-30..33 Upload
export async function upload(req, res) {
  const meta = createMaterialMetaSchema.parse(req.body);
  const material = await materialService.uploadMaterial(
    req.user,
    meta,
    req.file,
    tenantCtx(req),
  );
  return sendSuccess(res, {
    status: 201,
    message: 'Material uploaded and pending approval',
    data: { material },
  });
}

export async function listApproved(req, res) {
  const { page, limit } = parsePage(req.query);
  const sortAlias = req.query.view || req.query.sort || 'latest';
  const sort =
    sortAlias === 'trending' || sortAlias === 'popular'
      ? 'popular'
      : sortAlias === 'top-rated' || sortAlias === 'top_rated'
        ? 'top_rated'
        : sortAlias === 'latest'
          ? 'latest'
          : 'latest';

  const result = await materialService.searchMaterials({
    page,
    limit,
    q: req.query.q,
    university: req.query.university,
    campus: req.query.campus,
    department: req.query.department,
    course: req.query.course,
    subject: req.query.subject,
    type: req.query.type,
    sort,
    tenantCtx: tenantCtx(req),
  });
  return sendSuccess(res, { data: { items: result.items }, meta: result.meta });
}

export async function listMine(req, res) {
  const result = await materialService.listMine(req.user._id, parsePage(req.query));
  return sendSuccess(res, { data: { items: result.items }, meta: result.meta });
}

export async function getOne(req, res) {
  const material = await materialService.getMaterialById(
    req.params.id,
    req.user,
    tenantCtx(req),
  );
  return sendSuccess(res, { data: { material } });
}

export async function update(req, res) {
  const input = updateMaterialSchema.parse(req.body);
  const material = await materialService.updateMaterial(
    req.params.id,
    req.user,
    input,
    tenantCtx(req),
  );
  return sendSuccess(res, { message: 'Material updated', data: { material } });
}

export async function remove(req, res) {
  await materialService.deleteMaterial(req.params.id, req.user, tenantCtx(req));
  return sendSuccess(res, { message: 'Material deleted', data: null });
}

export async function download(req, res) {
  const preview = req.query.preview === '1' || req.query.preview === 'true';
  const access = await materialService.getMaterialFileAccess(req.params.id, req.user, {
    countDownload: !preview,
    tenantCtx: tenantCtx(req),
  });

  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (access.mode === 'redirect') {
    return sendSuccess(res, {
      message: 'Signed URL ready',
      data: { url: access.url, expiresIn: access.expiresIn || 300 },
    });
  }

  const { material, stream } = access;
  const disposition = preview ? 'inline' : 'attachment';
  const safeName = encodeURIComponent(material.file.originalName || 'download');
  res.setHeader('Content-Type', material.file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        data: null,
        message: 'File missing from storage',
        code: 'FILE_MISSING',
      });
    }
  });
  return stream.pipe(res);
}

export async function fileUrl(req, res) {
  const access = await materialService.getMaterialFileAccess(req.params.id, req.user, {
    countDownload: false,
    tenantCtx: tenantCtx(req),
  });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (access.mode === 'redirect') {
    return sendSuccess(res, {
      data: { url: access.url, mode: 'remote', expiresIn: access.expiresIn || 300 },
    });
  }
  return sendSuccess(res, {
    data: {
      mode: 'local',
      url: `/api/v1/materials/${req.params.id}/file`,
      expiresIn: access.expiresIn || 300,
    },
  });
}

export async function listPending(req, res) {
  const result = await materialService.listPending({
    ...parsePage(req.query),
    adminUser: req.user,
  });
  return sendSuccess(res, { data: { items: result.items }, meta: result.meta });
}

export async function moderate(req, res) {
  const status = req.body.status;
  const rejectionReason = req.body.rejectionReason;
  const material = await materialService.moderateMaterial(req.params.id, req.user, {
    status,
    rejectionReason,
  });
  const { writeAudit, clientIp } = await import('../../utils/audit.js');
  await writeAudit({
    actor: req.user,
    role: req.user.role,
    tenantId: req.tenant?._id,
    action: status === 'approved' ? 'moderation.approve' : 'moderation.reject',
    target: { type: 'material', id: material.id || req.params.id, label: material.title },
    meta: status === 'rejected' ? { hasReason: Boolean(rejectionReason) } : undefined,
    ip: clientIp(req),
  });
  return sendSuccess(res, { message: `Material ${status}`, data: { material } });
}

export function ensureFile(req, _res, next) {
  if (!req.file) {
    return next(new AppError('File is required', 400, { code: 'NO_FILE' }));
  }
  next();
}
