import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import taxonomyRoutes from '../modules/taxonomy/taxonomy.routes.js';
import materialRoutes from '../modules/materials/material.routes.js';
import tenantRoutes from '../modules/tenants/tenant.routes.js';
import platformRoutes from '../modules/platform/platform.routes.js';
import inviteRoutes from '../modules/invites/invite.routes.js';
import tenantAdminRoutes from '../modules/tenantAdmin/tenantAdmin.routes.js';

const router = Router();

// Public unscoped
router.use('/health', healthRoutes);
router.use('/tenants', tenantRoutes);

// Platform (superadmin only — handlers use skipTenant explicitly)
router.use('/platform', platformRoutes);

// Tenant-scoped
router.use('/auth', authRoutes);
router.use('/taxonomy', taxonomyRoutes);
router.use('/materials', materialRoutes);
router.use('/invites', inviteRoutes);
router.use('/tenant-admin', tenantAdminRoutes);

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'Peer-to-Peer Learning Platform API', version: 'v1' },
    message: 'API root',
  });
});

export default router;
