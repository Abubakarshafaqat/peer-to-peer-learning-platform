import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { resolveTenant, attachOrgScope } from '../../middleware/tenant.js';
import { signupRateLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { createInviteSchema } from '../auth/auth.validation.js';
import * as inviteService from './invite.service.js';

const router = Router();

router.post(
  '/',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  signupRateLimiter,
  validate(createInviteSchema),
  asyncHandler(async (req, res) => {
    const { invite, plainCode } = await inviteService.createInvite(req.user, req.body);
    const { writeAudit, clientIp } = await import('../../utils/audit.js');
    await writeAudit({
      actor: req.user,
      role: req.user.role,
      tenantId: req.tenant._id,
      action: 'invite.create',
      target: { type: 'invite', id: invite._id },
      meta: { maxUses: invite.maxUses },
      ip: clientIp(req),
    });
    return sendSuccess(res, {
      status: 201,
      message: 'Invite created — store the code now; it will not be shown again',
      data: { invite: inviteService.toPublicInvite(invite), code: plainCode },
    });
  }),
);

router.get(
  '/',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  asyncHandler(async (req, res) => {
    const includeRevoked = req.query.includeRevoked === 'true';
    const items = await inviteService.listInvites(req.user, { includeRevoked });
    return sendSuccess(res, { data: { items } });
  }),
);

router.post(
  '/:id/revoke',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  asyncHandler(async (req, res) => {
    const invite = await inviteService.revokeInvite(req.user, req.params.id);
    const { writeAudit, clientIp } = await import('../../utils/audit.js');
    await writeAudit({
      actor: req.user,
      role: req.user.role,
      tenantId: req.tenant._id,
      action: 'invite.revoke',
      target: { type: 'invite', id: req.params.id },
      ip: clientIp(req),
    });
    return sendSuccess(res, { message: 'Invite revoked', data: { invite } });
  }),
);

export default router;
