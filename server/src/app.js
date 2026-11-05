import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { sanitize } from './middleware/sanitize.js';
import { errorHandler, notFound } from './middleware/error.js';
import routes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'upgrade-insecure-requests': null,
        },
      },
    })
  );
  app.use(cors({ origin: env.corsOrigins }));

  // Never write live-tracking tokens to access logs.
  morgan.token('safe-url', (req) => req.originalUrl.replace(/\/track\/[^/?]+/, '/track/:token'));
  app.use(morgan(env.isProd ? ':remote-addr :method :safe-url :status :response-time ms' : ':method :safe-url :status :response-time ms'));

  app.use(express.json({ limit: '50kb' }));
  app.use(sanitize);
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1500, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', routes);
  app.use('/api', notFound);

  // In production the API also serves the built React app (same origin, no CORS needed).
  const dist = path.resolve(__dirname, '../../client/dist');
  if (env.isProd && fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|socket\.io).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
