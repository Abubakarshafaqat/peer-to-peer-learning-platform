import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, optionalAuthenticate, requireRole } from '../../middleware/auth.js';
import { attachOrgScope, resolveTenant } from '../../middleware/tenant.js';
import { uploadMaterialFile, handleMulterError } from '../../middleware/upload.js';
import { requireEmailVerified } from '../../middleware/requireEmailVerified.js';
import * as materialController from './material.controller.js';

const router = Router();

// Order: resolve SaaS tenant → auth (JWT bound to tenant) → inside-tenant org scope
router.get(
  '/',
  resolveTenant,
  optionalAuthenticate,
  attachOrgScope,
  asyncHandler(materialController.listApproved),
);
router.get(
  '/mine',
  resolveTenant,
  authenticate,
  attachOrgScope,
  asyncHandler(materialController.listMine),
);
router.get(
  '/pending',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  asyncHandler(materialController.listPending),
);
router.get(
  '/:id',
  resolveTenant,
  optionalAuthenticate,
  attachOrgScope,
  asyncHandler(materialController.getOne),
);

router.post(
  '/',
  resolveTenant,
  authenticate,
  requireEmailVerified,
  attachOrgScope,
  uploadMaterialFile,
  handleMulterError,
  materialController.ensureFile,
  asyncHandler(materialController.upload),
);

router.patch(
  '/:id',
  resolveTenant,
  authenticate,
  attachOrgScope,
  asyncHandler(materialController.update),
);
router.patch(
  '/:id/moderation',
  resolveTenant,
  authenticate,
  requireRole('tenantAdmin'),
  attachOrgScope,
  asyncHandler(materialController.moderate),
);
router.delete(
  '/:id',
  resolveTenant,
  authenticate,
  attachOrgScope,
  asyncHandler(materialController.remove),
);

router.get(
  '/:id/file',
  resolveTenant,
  authenticate,
  attachOrgScope,
  asyncHandler(materialController.download),
);
router.get(
  '/:id/file-url',
  resolveTenant,
  authenticate,
  attachOrgScope,
  asyncHandler(materialController.fileUrl),
);

export default router;
