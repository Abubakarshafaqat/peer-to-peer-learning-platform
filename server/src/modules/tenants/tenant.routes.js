import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { Tenant, getSignupMode } from '../../models/Tenant.js';
import { AppError } from '../../utils/AppError.js';
import { TENANT_SLUG_RE } from '../../middleware/tenant.js';
import { publicTenantsRateLimiter } from '../../middleware/rateLimit.js';

const router = Router();

/**
 * Public picker list — name, slug, logo only. Rate limited.
 * GET /tenants/public
 */
router.get(
  '/public',
  publicTenantsRateLimiter,
  asyncHandler(async (_req, res) => {
    const tenants = await Tenant.find({ status: 'active', deletedAt: null })
      .sort({ name: 1 })
      .select('name slug logoUrl')
      .lean();
    return sendSuccess(res, {
      data: {
        items: tenants.map((t) => ({
          name: t.name,
          slug: t.slug,
          logoUrl: t.logoUrl || '',
        })),
      },
    });
  }),
);

/** @deprecated Prefer GET /tenants/public — kept for older clients */
router.get(
  '/',
  publicTenantsRateLimiter,
  asyncHandler(async (_req, res) => {
    const tenants = await Tenant.find({ status: 'active', deletedAt: null })
      .sort({ name: 1 })
      .select('name slug logoUrl')
      .lean();
    return sendSuccess(res, {
      data: {
        items: tenants.map((t) => ({
          name: t.name,
          slug: t.slug,
          logoUrl: t.logoUrl || '',
        })),
      },
    });
  }),
);

/**
 * Public branding for a slug.
 * Includes signupMode + allowedDomains (for register UX). Never settings/id.
 * Suspended / deleted / unknown → structured error for client unavailable page.
 */
router.get(
  '/:slug/branding',
  publicTenantsRateLimiter,
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!TENANT_SLUG_RE.test(slug)) {
      throw new AppError('Invalid tenant slug', 400, { code: 'TENANT_SLUG_INVALID' });
    }

    const tenant = await Tenant.findOne({ slug, deletedAt: null }).lean();
    if (!tenant) {
      throw new AppError('University unavailable', 404, { code: 'TENANT_NOT_FOUND' });
    }
    if (tenant.status === 'suspended') {
      throw new AppError('University unavailable', 403, { code: 'TENANT_SUSPENDED' });
    }
    if (tenant.status !== 'active') {
      throw new AppError('University unavailable', 404, { code: 'TENANT_NOT_FOUND' });
    }

    const signupMode = getSignupMode(tenant);
    const allowedDomains =
      signupMode === 'domain' || signupMode === 'both'
        ? (tenant.domainWhitelist || []).map((d) => String(d).toLowerCase())
        : [];

    return sendSuccess(res, {
      data: {
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl || '',
          theme: tenant.theme || {},
          signupMode,
          allowedDomains,
        },
      },
    });
  }),
);

export default router;
