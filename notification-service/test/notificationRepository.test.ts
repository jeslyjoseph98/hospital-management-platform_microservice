import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationRepository } from '../src/repositories/notificationRepository';

function makeMockPool(queryImpl: (...args: any[]) => any) {
  return { query: vi.fn(queryImpl) } as any;
}

describe('NotificationRepository', () => {
  describe('insertIfNew (NTF-R1, NTF-R2)', () => {
    it('returns true when a row was inserted', async () => {
      const pool = makeMockPool(() => Promise.resolve({ rowCount: 1, rows: [] }));
      const repo = new NotificationRepository(pool);

      const inserted = await repo.insertIfNew({
        eventId: 'evt-1',
        patientId: 42,
        title: 'Booking successful',
        message: 'msg',
        appointmentId: 1
      });

      expect(inserted).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (event_id) DO NOTHING'),
        ['evt-1', 42, 'Booking successful', 'msg', 1]
      );
    });

    it('returns false when ON CONFLICT DO NOTHING skipped the insert (duplicate event_id)', async () => {
      const pool = makeMockPool(() => Promise.resolve({ rowCount: 0, rows: [] }));
      const repo = new NotificationRepository(pool);

      const inserted = await repo.insertIfNew({
        eventId: 'evt-1',
        patientId: 42,
        title: 'Booking successful',
        message: 'msg',
        appointmentId: 1
      });

      expect(inserted).toBe(false);
    });

    it('propagates a query failure (e.g. DB down) so the caller can rethrow', async () => {
      const pool = makeMockPool(() => Promise.reject(new Error('connection refused')));
      const repo = new NotificationRepository(pool);

      await expect(
        repo.insertIfNew({ eventId: 'evt-1', patientId: 42, title: 't', message: 'm', appointmentId: 1 })
      ).rejects.toThrow('connection refused');
    });
  });

  describe('markReadForPatient (NTF-R4, NTF-R5)', () => {
    it('updates and returns the row when it belongs to the patient and is unread', async () => {
      const updatedRow = { id: '1', patient_id: '42', is_read: true };
      const pool = makeMockPool((sql: string) => {
        if (sql.includes('UPDATE notifications')) {
          return Promise.resolve({ rows: [updatedRow], rowCount: 1 });
        }
        throw new Error('unexpected query');
      });
      const repo = new NotificationRepository(pool);

      const result = await repo.markReadForPatient(1, 42);
      expect(result).toEqual(updatedRow);
    });

    it('falls back to a plain select (already read) and returns the existing row unchanged', async () => {
      const existingRow = { id: '1', patient_id: '42', is_read: true };
      const pool = makeMockPool((sql: string) => {
        if (sql.includes('UPDATE notifications')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (sql.includes('SELECT * FROM notifications WHERE id')) {
          return Promise.resolve({ rows: [existingRow], rowCount: 1 });
        }
        throw new Error('unexpected query');
      });
      const repo = new NotificationRepository(pool);

      const result = await repo.markReadForPatient(1, 42);
      expect(result).toEqual(existingRow);
    });

    it('returns null when the notification does not belong to the patient (ownership, NTF-R4)', async () => {
      const pool = makeMockPool((sql: string) => {
        if (sql.includes('UPDATE notifications')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (sql.includes('SELECT * FROM notifications WHERE id')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        throw new Error('unexpected query');
      });
      const repo = new NotificationRepository(pool);

      const result = await repo.markReadForPatient(1, 999);
      expect(result).toBeNull();
    });
  });
});
