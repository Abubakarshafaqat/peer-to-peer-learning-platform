import { Router } from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

// Health check for Render / uptime monitors
router.get('/', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbOk = dbState === 1;

  return sendSuccess(res, {
    message: dbOk ? 'Healthy' : 'Degraded',
    data: {
      status: dbOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      database: dbOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
    status: dbOk ? 200 : 503,
  });
});

export default router;
