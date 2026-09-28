import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// API modules (users, materials, …) land here in later phases
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'Peer-to-Peer Learning Platform API', version: 'v1' },
    message: 'API root',
  });
});

export default router;
