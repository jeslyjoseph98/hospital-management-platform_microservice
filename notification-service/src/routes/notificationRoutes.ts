import { Router } from 'express';
import { z } from 'zod';
import { NotificationService } from '../services/notificationService';
import { patientContext } from '../middleware/patientContext';
import { BusinessError } from '../utils/BusinessError';
import { ok } from '../utils/respond';

const pageQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 0 : parseInt(v, 10)))
    .refine((v) => Number.isInteger(v) && v >= 0, { message: 'page must be a non-negative integer' }),
  size: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 20 : parseInt(v, 10)))
    .refine((v) => Number.isInteger(v) && v > 0 && v <= 100, {
      message: 'size must be an integer between 1 and 100'
    })
});

const idParamSchema = z
  .string()
  .regex(/^\d+$/, 'id must be a positive integer')
  .transform((v) => parseInt(v, 10));

export function buildNotificationRoutes(service: NotificationService): Router {
  const router = Router();

  router.use(patientContext);

  router.get('/my', async (req, res, next) => {
    try {
      const parsed = pageQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BusinessError(
          'VALIDATION_FAILED',
          400,
          'Invalid pagination parameters',
          parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'query', message: i.message }))
        );
      }
      const { page, size } = parsed.data;
      const result = await service.listOwn(req.patientId, page, size);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/my/unread-count', async (req, res, next) => {
    try {
      const count = await service.unreadCount(req.patientId);
      ok(res, { count });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/read', async (req, res, next) => {
    try {
      const idParsed = idParamSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        throw new BusinessError('NTF_NOT_FOUND', 404, 'Notification not found');
      }
      const dto = await service.markRead(idParsed.data, req.patientId);
      ok(res, dto, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  });

  return router;
}
