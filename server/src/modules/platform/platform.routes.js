import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticatePlatform } from '../../middleware/auth.js';
import { authRateLimiter, signupRateLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema, createInviteSchema } from '../auth/auth.validation.js';
import * as authController from '../auth/auth.controller.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { Tenant } from '../../models/Tenant.js';
import { Invite } from '../../models/Invite.js';
import { AuditLog } from '../../models/AuditLog.js';
import { AppError } from '../../utils/AppError.js';
import { runWithTenantContext } from '../../utils/tenantContext.js';
import { writeAudit, clientIp } from '../../utils/audit.js';
import * as inviteService from '../invites/invite.service.js';
import * as platformTenant from './platformTenant.service.js';

const router = Router();

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(40),
  domainWhitelist: z.array(z.string()).optional().default([]),
  signupMode: z.enum(['domain', 'invite', 'both', 'closed']).optional(),
  logoUrl: z.string().optional().default(''),
  theme: z
    .object({ primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() })
    .optional(),
  settings: z
    .object({
      maxUploadMB: z.coerce.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
      moderationEnabled: z.boolean().optional(),
    })
    .optional(),
  firstAdmin: z
    .object({
      email: z.string().email(),
      username: z.string().min(3).max(32).optional(),
      fullName: z.string().min(2).max(120).optional(),
    })
    .optional(),
});

const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  logoUrl: z.string().optional(),
  theme: z
    .object({ primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })
    .optional(),
  domainWhitelist: z.array(z.string()).optional(),
  signupMode: z.enum(['domain', 'invite', 'both', 'closed']).optional(),
  settings: z
    .object({
      maxUploadMB: z.coerce.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
      moderationEnabled: z.boolean().optional(),
    })
    .optional(),
  slug: z.any().optional(), // rejected as immutable in service
});

router.post(
  '/auth/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.platformLogin),
);

router.post('/auth/refresh', authRateLimiter, asyncHandler(authController.platformRefresh));
router.post('/auth/logout', asyncHandler(authController.logout));
router.get('/auth/me', authenticatePlatform, asyncHandler(authController.me));

router.get(
  '/stats',
  authenticatePlatform,
  asyncHandler(async (_req, res) => {
    const data = await platformTenant.platformOverviewStats();
    return sendSuccess(res, { data });
  }),
);

router.get(
  '/tenants',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const includeDeleted = req.query.includeDeleted === 'true';
    const items = await platformTenant.listTenants({ includeDeleted });
    return sendSuccess(res, { data: { items } });
  }),
);

router.post(
  '/tenants',
  authenticatePlatform,
  validate(createTenantSchema),
  asyncHandler(async (req, res) => {
    const result = await platformTenant.createTenant(req.body, req.user, req);
    return sendSuccess(res, {
      status: 201,
      message: 'Tenant created',
      data: result,
    });
  }),
);

router.get(
  '/tenants/:id',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const tenant = await platformTenant.getTenant(req.params.id);
    return sendSuccess(res, { data: { tenant } });
  }),
);

router.patch(
  '/tenants/:id',
  authenticatePlatform,
  validate(updateTenantSchema),
  asyncHandler(async (req, res) => {
    const tenant = await platformTenant.updateTenant(req.params.id, req.body, req.user, req);
    return sendSuccess(res, { message: 'Tenant updated', data: { tenant } });
  }),
);

router.patch(
  '/tenants/:id/status',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const tenant = await platformTenant.setTenantStatus(
      req.params.id,
      req.body.status,
      req.user,
      req,
    );
    return sendSuccess(res, {
      message: `Tenant ${tenant.status}`,
      data: { tenant },
    });
  }),
);

router.delete(
  '/tenants/:id',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const tenant = await platformTenant.softDeleteTenant(req.params.id, req.user, req);
    return sendSuccess(res, { message: 'Tenant soft-deleted', data: { tenant } });
  }),
);

router.patch(
  '/tenants/:id/signup-mode',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const tenant = await platformTenant.setSignupMode(
      req.params.id,
      req.body.signupMode,
      req.user,
      req,
    );
    return sendSuccess(res, { data: { tenant } });
  }),
);

router.get(
  '/tenants/:id/stats',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const stats = await platformTenant.tenantStats(req.params.id);
    return sendSuccess(res, { data: { stats } });
  }),
);

router.get(
  '/tenants/:id/audit',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('Invalid tenant id', 400, { code: 'INVALID_ID' });
    }
    const tenantObjectId = new mongoose.Types.ObjectId(String(req.params.id));
    // Explicit ObjectId — never null-tenant or string-coercion cross-matches
    const filter = { tenantId: tenantObjectId };
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return sendSuccess(res, {
      data: {
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
      },
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  }),
);

router.post(
  '/tenants/:id/invites',
  authenticatePlatform,
  signupRateLimiter,
  validate(createInviteSchema),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

    const result = await runWithTenantContext({ tenantId: tenant._id, tenant }, async () =>
      inviteService.createInvite(req.user, req.body),
    );

    await writeAudit({
      actor: req.user,
      role: req.user.role,
      tenantId: tenant._id,
      action: 'invite.create',
      target: { type: 'invite', id: result.invite._id },
      meta: { maxUses: result.invite.maxUses },
      ip: clientIp(req),
    });

    return sendSuccess(res, {
      status: 201,
      message: 'Invite created',
      data: {
        invite: inviteService.toPublicInvite(result.invite),
        code: result.plainCode,
        tenantSlug: tenant.slug,
      },
    });
  }),
);

router.get(
  '/tenants/:id/invites',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

    const items = await runWithTenantContext({ tenantId: tenant._id, tenant }, async () => {
      const docs = await Invite.find({}).sort({ createdAt: -1 }).limit(100).lean();
      return docs.map(inviteService.toPublicInvite);
    });

    return sendSuccess(res, { data: { items } });
  }),
);

router.post(
  '/tenants/:tenantId/invites/:inviteId/revoke',
  authenticatePlatform,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant || tenant.deletedAt) throw new AppError('Tenant not found', 404);

    const invite = await runWithTenantContext({ tenantId: tenant._id, tenant }, async () =>
      inviteService.revokeInvite(req.user, req.params.inviteId),
    );

    await writeAudit({
      actor: req.user,
      role: req.user.role,
      tenantId: tenant._id,
      action: 'invite.revoke',
      target: { type: 'invite', id: req.params.inviteId },
      ip: clientIp(req),
    });

    return sendSuccess(res, { message: 'Invite revoked', data: { invite } });
  }),
);

export default router;
