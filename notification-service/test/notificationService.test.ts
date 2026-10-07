import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationService } from '../src/services/notificationService';
import { NotificationRepository, NotificationRow } from '../src/repositories/notificationRepository';
import { BusinessError } from '../src/utils/BusinessError';

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: '1',
    event_id: 'evt-1',
    patient_id: '42',
    title: 'Booking successful',
    message: 'Your appointment is confirmed.',
    appointment_id: '100',
    is_read: false,
    read_at: null,
    created_at: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides
  };
}

describe('NotificationService', () => {
  let repo: NotificationRepository;
  let service: NotificationService;

  beforeEach(() => {
    repo = {
      findPageForPatient: vi.fn(),
      countForPatient: vi.fn(),
      countUnreadForPatient: vi.fn(),
      findByIdForPatient: vi.fn(),
      markReadForPatient: vi.fn(),
      insertIfNew: vi.fn()
    } as unknown as NotificationRepository;
    service = new NotificationService(repo);
  });

  it('listOwn maps rows to camelCase DTOs with pagination metadata', async () => {
    (repo.findPageForPatient as any).mockResolvedValue([row()]);
    (repo.countForPatient as any).mockResolvedValue(1);

    const result = await service.listOwn(42, 0, 20);

    expect(repo.findPageForPatient).toHaveBeenCalledWith(42, 0, 20);
    expect(result.totalElements).toBe(1);
    expect(result.content[0]).toEqual({
      id: 1,
      title: 'Booking successful',
      message: 'Your appointment is confirmed.',
      appointmentId: 100,
      isRead: false,
      readAt: null,
      createdAt: '2026-10-01T00:00:00.000Z'
    });
  });

  it('unreadCount delegates to the repository for the given patient', async () => {
    (repo.countUnreadForPatient as any).mockResolvedValue(4);
    const count = await service.unreadCount(42);
    expect(count).toBe(4);
    expect(repo.countUnreadForPatient).toHaveBeenCalledWith(42);
  });

  describe('markRead (NTF-R4, NTF-R5)', () => {
    it('returns the updated DTO when the notification belongs to the patient', async () => {
      (repo.markReadForPatient as any).mockResolvedValue(row({ is_read: true, read_at: new Date('2026-10-02T00:00:00.000Z') }));

      const dto = await service.markRead(1, 42);

      expect(repo.markReadForPatient).toHaveBeenCalledWith(1, 42);
      expect(dto.isRead).toBe(true);
      expect(dto.readAt).toBe('2026-10-02T00:00:00.000Z');
    });

    it('throws NTF_NOT_FOUND (404) when the repository finds no row for that patient (ownership)', async () => {
      (repo.markReadForPatient as any).mockResolvedValue(null);

      await expect(service.markRead(1, 999)).rejects.toMatchObject({
        code: 'NTF_NOT_FOUND',
        status: 404
      });
    });

    it('propagates BusinessError type correctly', async () => {
      (repo.markReadForPatient as any).mockResolvedValue(null);
      await expect(service.markRead(1, 999)).rejects.toBeInstanceOf(BusinessError);
    });
  });
});
