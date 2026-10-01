import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sanitizeRequest } from './middleware/sanitize.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant'],
      exposedHeaders: ['x-tenant'],
    }),
  );

  morgan.token('tenant', (req) => req.tenantSlug || req.headers['x-tenant'] || '-');
  app.use(
    morgan(
      env.NODE_ENV === 'production'
        ? ':remote-addr :method :url :status tenant=:tenant :response-time ms'
        : 'dev',
    ),
  );
  // Always log tenant id in custom short line for both envs
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (env.NODE_ENV !== 'production') {
        const tid = req.tenantId ? String(req.tenantId) : '-';
        // eslint-disable-next-line no-console
        console.log(
          `[tenant=${req.tenantSlug || req.headers['x-tenant'] || '-'} id=${tid}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
        );
      }
    });
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  // Never trust body/query tenantId for scoping — strip if present
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      delete req.body.tenantId;
      delete req.body.tid;
    }
    next();
  });

  app.use('/uploads', (req, res, next) => {
    // Materials live under private `storage/`; never expose tenant folders via static
    if (String(req.path || '').includes('tenants')) {
      return res.status(404).end();
    }
    return next();
  });
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
