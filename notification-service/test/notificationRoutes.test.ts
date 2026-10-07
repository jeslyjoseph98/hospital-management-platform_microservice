import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildNotificationRoutes } from '../src/routes/notificationRoutes';
import { NotificationService } from '../src/services/notificationService';
import { BusinessError } from '../src/utils/BusinessError';

function buildTestApp(service: NotificationService) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/notifications', buildNotificationRoutes(service));
  // minimal error handler mirroring src/app.ts
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof BusinessError) {
      res.status(err.status).json({
        success: false,
        errorCode: err.code,
        message: err.message,
        fieldErrors: err.fieldErrors,
        data: null
      });
      return;
    }
    res.status(500).json({ success: false, errorCode: 'INTERNAL_ERROR', message: 'oops', fieldErrors: [], data: null });
  });
  return app;
}

describe('notification routes', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = {
      listOwn: vi.fn(),
      unreadCount: vi.fn(),
      markRead: vi.fn()
    } as unknown as NotificationService;
  });

  describe('GET /my', () => {
    it('returns 403 when X-Patient-Id header is missing', async () => {
      const app = buildTestApp(service);
      const res = await request(app).get('/api/v1/notifications/my');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('AUTH_FORBIDDEN');
    });

    it('uses default page=0 size=20 and passes patientId from header', async () => {
      const app = buildTestApp(service);
      (service.listOwn as any).mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 });

      const res = await request(app).get('/api/v1/notifications/my').set('X-Patient-Id', '42');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(service.listOwn).toHaveBeenCalledWith(42, 0, 20);
    });

    it('passes explicit page and size query params', async () => {
      const app = buildTestApp(service);
      (service.listOwn as any).mockResolvedValue({ content: [], page: 2, size: 5, totalElements: 11 });

      const res = await request(app)
        .get('/api/v1/notifications/my?page=2&size=5')
        .set('X-Patient-Id', '42');

      expect(res.status).toBe(200);
      expect(service.listOwn).toHaveBeenCalledWith(42, 2, 5);
      expect(res.body.data.totalElements).toBe(11);
    });

    it('returns 400 VALIDATION_FAILED for an invalid page param', async () => {
      const app = buildTestApp(service);
      const res = await request(app)
        .get('/api/v1/notifications/my?page=-1')
        .set('X-Patient-Id', '42');

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_FAILED');
      expect(res.body.fieldErrors.length).toBeGreaterThan(0);
    });

    it('scopes the list strictly to the requesting patient (ownership)', async () => {
      const app = buildTestApp(service);
      (service.listOwn as any).mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 });

      await request(app).get('/api/v1/notifications/my').set('X-Patient-Id', '7');

      expect(service.listOwn).toHaveBeenCalledWith(7, 0, 20);
      expect(service.listOwn).not.toHaveBeenCalledWith(expect.not.objectContaining({}), 0, 20);
    });
  });

  describe('GET /my/unread-count', () => {
    it('returns the count for the bell badge', async () => {
      const app = buildTestApp(service);
      (service.unreadCount as any).mockResolvedValue(3);

      const res = await request(app)
        .get('/api/v1/notifications/my/unread-count')
        .set('X-Patient-Id', '42');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ count: 3 });
      expect(service.unreadCount).toHaveBeenCalledWith(42);
    });
  });

  describe('PATCH /:id/read', () => {
    it('marks a notification read and returns it', async () => {
      const app = buildTestApp(service);
      const dto = {
        id: 5,
        title: 'Booking successful',
        message: 'msg',
        appointmentId: 1,
        isRead: true,
        readAt: '2026-10-06T00:00:00.000Z',
        createdAt: '2026-10-05T00:00:00.000Z'
      };
      (service.markRead as any).mockResolvedValue(dto);

      const res = await request(app)
        .patch('/api/v1/notifications/5/read')
        .set('X-Patient-Id', '42');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(dto);
      expect(service.markRead).toHaveBeenCalledWith(5, 42);
    });

    it('returns 404 NTF_NOT_FOUND when the notification belongs to another patient', async () => {
      const app = buildTestApp(service);
      (service.markRead as any).mockRejectedValue(
        new BusinessError('NTF_NOT_FOUND', 404, 'Notification not found')
      );

      const res = await request(app)
        .patch('/api/v1/notifications/5/read')
        .set('X-Patient-Id', '99');

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('NTF_NOT_FOUND');
      expect(service.markRead).toHaveBeenCalledWith(5, 99);
    });

    it('returns 404 NTF_NOT_FOUND for a non-numeric id without calling the service', async () => {
      const app = buildTestApp(service);
      const res = await request(app)
        .patch('/api/v1/notifications/not-a-number/read')
        .set('X-Patient-Id', '42');

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('NTF_NOT_FOUND');
      expect(service.markRead).not.toHaveBeenCalled();
    });

    it('is idempotent: marking an already-read notification succeeds and changes nothing new', async () => {
      const app = buildTestApp(service);
      const dto = {
        id: 5,
        title: 'Booking successful',
        message: 'msg',
        appointmentId: 1,
        isRead: true,
        readAt: '2026-10-05T00:00:00.000Z',
        createdAt: '2026-10-04T00:00:00.000Z'
      };
      (service.markRead as any).mockResolvedValue(dto);

      const res1 = await request(app).patch('/api/v1/notifications/5/read').set('X-Patient-Id', '42');
      const res2 = await request(app).patch('/api/v1/notifications/5/read').set('X-Patient-Id', '42');

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res2.body.data.isRead).toBe(true);
      expect(service.markRead).toHaveBeenCalledTimes(2);
    });
  });
});
