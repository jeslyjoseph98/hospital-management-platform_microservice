import { Pool } from 'pg';

export interface NotificationRow {
  id: string;
  event_id: string;
  patient_id: string;
  title: string;
  message: string;
  appointment_id: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
}

export interface InsertNotificationParams {
  eventId: string;
  patientId: number;
  title: string;
  message: string;
  appointmentId: number;
}

export class NotificationRepository {
  constructor(private readonly db: Pool) {}

  /**
   * Idempotent insert keyed on event_id. Returns true if a row was inserted,
   * false if the event_id already existed (duplicate delivery).
   */
  async insertIfNew(params: InsertNotificationParams): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO notifications (event_id, patient_id, title, message, appointment_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO NOTHING`,
      [params.eventId, params.patientId, params.title, params.message, params.appointmentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findPageForPatient(
    patientId: number,
    page: number,
    size: number
  ): Promise<NotificationRow[]> {
    const result = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE patient_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [patientId, size, page * size]
    );
    return result.rows;
  }

  async countForPatient(patientId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE patient_id = $1`,
      [patientId]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async countUnreadForPatient(patientId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE patient_id = $1 AND is_read = false`,
      [patientId]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async findByIdForPatient(id: number, patientId: number): Promise<NotificationRow | null> {
    const result = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications WHERE id = $1 AND patient_id = $2`,
      [id, patientId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Marks a notification as read. Idempotent: if already read, nothing changes
   * but the row is still returned. Scoped to the owning patient.
   */
  async markReadForPatient(id: number, patientId: number): Promise<NotificationRow | null> {
    const result = await this.db.query<NotificationRow>(
      `UPDATE notifications
       SET is_read = true, read_at = now()
       WHERE id = $1 AND patient_id = $2 AND is_read = false
       RETURNING *`,
      [id, patientId]
    );
    if (result.rows[0]) {
      return result.rows[0];
    }
    // Already read (or doesn't exist) — fetch current state to distinguish.
    return this.findByIdForPatient(id, patientId);
  }
}
