import express, { Express, NextFunction, Request, Response } from 'express';
import { pool } from './db/pool';
import { NotificationRepository } from './repositories/notificationRepository';
import { NotificationService } from './services/notificationService';
import { buildNotificationRoutes } from './routes/notificationRoutes';
import { BusinessError } from './utils/BusinessError';
import { fail } from './utils/respond';

export function buildApp(): Express {
  const app = express();
  app.use(express.json());

  const repo = new NotificationRepository(pool);
  const service = new NotificationService(repo);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'UP' }));

  app.use('/api/v1/notifications', buildNotificationRoutes(service));

  app.use((req: Request, res: Response) => {
    fail(res, 404, 'NTF_NOT_FOUND', `No route ${req.method} ${req.path}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof BusinessError) {
      fail(res, err.status, err.code, err.message, err.fieldErrors);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error', err);
    fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  return app;
}
