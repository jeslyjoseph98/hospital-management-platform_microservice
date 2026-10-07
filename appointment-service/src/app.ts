import express, { Express } from 'express';
import { headerContext } from './middleware/headers';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { publicRouter } from './routes/publicRoutes';
import { internalRouter } from './routes/internalRoutes';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(headerContext);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'UP' });
  });

  app.use('/api/v1', publicRouter);
  app.use('/internal', internalRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
