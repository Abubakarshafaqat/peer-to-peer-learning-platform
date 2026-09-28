import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

// API modules (auth, users, materials, …) land here in later phases
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'Peer-to-Peer Learning Platform API', version: 'v1' },
    message: 'API root',
  });
});

export default router;
