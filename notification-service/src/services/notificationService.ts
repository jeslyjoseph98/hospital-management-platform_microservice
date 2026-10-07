import { NotificationRepository, NotificationRow } from '../repositories/notificationRepository';
import { BusinessError } from '../utils/BusinessError';

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  appointmentId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PageResult<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: Number(row.id),
    title: row.title,
    message: row.message,
    appointmentId: row.appointment_id === null ? null : Number(row.appointment_id),
    isRead: row.is_read,
    readAt: row.read_at ? row.read_at.toISOString() : null,
    createdAt: row.created_at.toISOString()
  };
}

export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  async listOwn(patientId: number, page: number, size: number): Promise<PageResult<NotificationDto>> {
    const [rows, totalElements] = await Promise.all([
      this.repo.findPageForPatient(patientId, page, size),
      this.repo.countForPatient(patientId)
    ]);
    return {
      content: rows.map(toDto),
      page,
      size,
      totalElements
    };
  }

  async unreadCount(patientId: number): Promise<number> {
    return this.repo.countUnreadForPatient(patientId);
  }

  /**
   * NTF-R4: a patient sees/updates only their own notifications; otherwise 404 NTF_NOT_FOUND.
   * NTF-R5: marking an already-read notification is allowed and changes nothing.
   */
  async markRead(id: number, patientId: number): Promise<NotificationDto> {
    const row = await this.repo.markReadForPatient(id, patientId);
    if (!row) {
      throw new BusinessError('NTF_NOT_FOUND', 404, 'Notification not found');
    }
    return toDto(row);
  }
}
