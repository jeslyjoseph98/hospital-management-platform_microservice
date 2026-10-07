import { Pool, PoolClient, types } from 'pg';
import { config } from '../config/env';

// BIGINT (OID 20) is returned as a string by `pg` by default to avoid silent precision loss.
// This service's BIGINT ids (appointments.id, doctor_id, patient_id, ...) never approach
// Number.MAX_SAFE_INTEGER, and the API spec's JSON examples show them as plain numbers
// (e.g. "appointmentId": 45), so parse BIGINT as a JS number for all queries on this pool.
types.setTypeParser(types.builtins.INT8, (value: string) => parseInt(value, 10));

// DATE (OID 1082) is parsed by `pg` into a JS Date at local midnight; converting that back to a
// YYYY-MM-DD string with .toISOString() shifts the date by a day whenever the host's local time
// zone is ahead of UTC (e.g. Asia/Kolkata, UTC+5:30). Dates are date-only values in this service
// (SVC-00 §5) with no time-of-day meaning, so keep the raw "YYYY-MM-DD" string from the wire
// instead of letting `pg` turn it into a Date at all.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

export const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  database: config.pg.database,
  user: config.pg.user,
  password: config.pg.password
});

/** Runs `fn` inside a BEGIN/COMMIT transaction on a single pooled client. Rolls back on error. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}
