import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { resolveTenant, attachOrgScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import * as svc from './tenantAdmin.service.js';

const router = Router();

const patchTenantSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  logoUrl: z.string().optional(),
  theme: z
    .object({
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be #RRGGBB'),
    })
    .optional(),
  settings: z
    .object({
      maxUploadMB: z.coerce.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
      moderationEnabled: z.boolean().optional(),
    })
    .optional(),
  // Rejected in service if present — listed so clients get clear errors via body parse
  slug: z.any().optional(),
  status: z.any().optional(),
  domainWhitelist: z.any().optional(),
  signupMode: z.any().optional(),
});

const roleSchema = z.object({
  role: z.enum(['student', 'tenantAdmin']),
  adminLevel: z.enum(['university', 'campus', 'department']).optional(),
});

const moderateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().max(500).optional().default(''),
});

function adminStack(handler) {
  return [
    resolveTenant,
    authenticate,
    requireRole('tenantAdmin'),
    attachOrgScope,
    asyncHandler(handler),
  ];
}

router.get('/tenant', ...adminStack(async (req, res) => {
  const tenant = await svc.getOwnTenant(req);
  return sendSuccess(res, { data: { tenant } });
}));

router.patch(
  '/tenant',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  validate(patchTenantSchema),
  asyncHandler(async (req, res) => {
    const tenant = await svc.patchOwnTenant(req, req.body);
    return sendSuccess(res, { message: 'Tenant updated', data: { tenant } });
  }),
);

router.get('/users', ...adminStack(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const result = await svc.listUsers(req, { q: req.query.q || '', page, limit });
  return sendSuccess(res, { data: { items: result.items }, meta: result.meta });
}));

router.patch('/users/:id/active', ...adminStack(async (req, res) => {
  const isActive = req.body.isActive !== false && req.body.isActive !== 'false';
  const user = await svc.setUserActive(req, req.params.id, isActive);
  return sendSuccess(res, { message: isActive ? 'User reactivated' : 'User deactivated', data: { user } });
}));

router.patch(
  '/users/:id/role',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const user = await svc.changeUserRole(req, req.params.id, req.body);
    return sendSuccess(res, { message: 'Role updated', data: { user } });
  }),
);

router.get('/moderation/pending', ...adminStack(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const result = await svc.listPending(req, { page, limit });
  return sendSuccess(res, { data: { items: result.items }, meta: result.meta });
}));

router.patch(
  '/moderation/:id',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  validate(moderateSchema),
  asyncHandler(async (req, res) => {
    const material = await svc.moderate(req, req.params.id, req.body);
    return sendSuccess(res, { message: `Material ${req.body.status}`, data: { material } });
  }),
);

router.get('/audit', ...adminStack(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const result = await svc.listAuditLogs(req, { page, limit });
  return sendSuccess(res, { data: { items: result.items }, meta: result.meta });
}));

export default router;
