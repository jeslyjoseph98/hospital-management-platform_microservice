import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';

export interface OutboxRow {
  id: number;
  event_id: string;
  topic: string;
  message_key: string;
  payload: unknown;
  status: 'NEW' | 'SENT';
  created_at: string;
  sent_at: string | null;
}

/** Inserts an outbox event in the SAME transaction as the business change (SVC-00 §8.3). */
export async function insertOutboxEvent(
  client: PoolClient,
  topic: string,
  messageKey: string,
  payload: unknown
): Promise<void> {
  const eventId = uuidv4();
  await client.query(
    `INSERT INTO outbox_events (event_id, topic, message_key, payload)
     VALUES ($1, $2, $3, $4)`,
    [eventId, topic, messageKey, JSON.stringify(payload)]
  );
}

/** OB-R1: oldest 50 NEW records. */
export async function fetchPendingBatch(limit = 50): Promise<OutboxRow[]> {
  const result = await pool.query<OutboxRow>(
    `SELECT * FROM outbox_events WHERE status = 'NEW' ORDER BY id ASC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/** OB-R2: mark a record SENT after a successful Kafka ack. */
export async function markSent(id: number): Promise<void> {
  await pool.query(`UPDATE outbox_events SET status = 'SENT', sent_at = now() WHERE id = $1`, [id]);
}
