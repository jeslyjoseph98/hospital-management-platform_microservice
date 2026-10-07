import { PoolClient } from 'pg';
import { pool } from '../db/pool';

export interface AppointmentRow {
  id: number;
  appointment_code: string | null;
  patient_id: number;
  doctor_id: number;
  appointment_date: string;
  token_number: number;
  reporting_time: string;
  reason: string | null;
  status: 'BOOKED' | 'COMPLETED';
  patient_name: string;
  patient_code: string;
  patient_gender: string;
  patient_dob: string;
  doctor_name: string;
  department_name: string;
  consultation_start: string;
  consultation_end: string;
  created_at: string;
  updated_at: string | null;
}

export interface NewAppointmentInput {
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  tokenNumber: number;
  reportingTime: string;
  reason: string | null;
  patientName: string;
  patientCode: string;
  patientGender: string;
  patientDob: string;
  doctorName: string;
  departmentName: string;
  consultationStart: string;
  consultationEnd: string;
}

/** Row-locks (or creates) the per-doctor-per-day counter row. Must run inside a transaction. */
export async function upsertAndLockCounter(
  client: PoolClient,
  doctorId: number,
  appointmentDate: string
): Promise<number> {
  await client.query(
    `INSERT INTO doctor_day_counters (doctor_id, appointment_date)
     VALUES ($1, $2)
     ON CONFLICT (doctor_id, appointment_date) DO NOTHING`,
    [doctorId, appointmentDate]
  );
  const result = await client.query<{ booked_count: number }>(
    `SELECT booked_count FROM doctor_day_counters
     WHERE doctor_id = $1 AND appointment_date = $2 FOR UPDATE`,
    [doctorId, appointmentDate]
  );
  return result.rows[0].booked_count;
}

/** APT-R7: does the patient already have an appointment with this doctor on this date? */
export async function existsForPatientDoctorDate(
  client: PoolClient,
  patientId: number,
  doctorId: number,
  appointmentDate: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM appointments
     WHERE patient_id = $1 AND doctor_id = $2 AND appointment_date = $3`,
    [patientId, doctorId, appointmentDate]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertAppointment(
  client: PoolClient,
  input: NewAppointmentInput
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO appointments (
       patient_id, doctor_id, appointment_date, token_number, reporting_time, reason,
       patient_name, patient_code, patient_gender, patient_dob,
       doctor_name, department_name, consultation_start, consultation_end
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      input.patientId,
      input.doctorId,
      input.appointmentDate,
      input.tokenNumber,
      input.reportingTime,
      input.reason,
      input.patientName,
      input.patientCode,
      input.patientGender,
      input.patientDob,
      input.doctorName,
      input.departmentName,
      input.consultationStart,
      input.consultationEnd
    ]
  );
  return result.rows[0].id;
}

export async function setAppointmentCode(client: PoolClient, id: number): Promise<string> {
  const code = 'APT' + id.toString().padStart(8, '0');
  await client.query(`UPDATE appointments SET appointment_code = $1 WHERE id = $2`, [code, id]);
  return code;
}

export async function incrementCounter(
  client: PoolClient,
  doctorId: number,
  appointmentDate: string
): Promise<void> {
  await client.query(
    `UPDATE doctor_day_counters SET booked_count = booked_count + 1
     WHERE doctor_id = $1 AND appointment_date = $2`,
    [doctorId, appointmentDate]
  );
}

export async function findById(id: number): Promise<AppointmentRow | null> {
  const result = await pool.query<AppointmentRow>(`SELECT * FROM appointments WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function findByIdForPatient(
  id: number,
  patientId: number
): Promise<AppointmentRow | null> {
  const result = await pool.query<AppointmentRow>(
    `SELECT * FROM appointments WHERE id = $1 AND patient_id = $2`,
    [id, patientId]
  );
  return result.rows[0] ?? null;
}

export async function findMyAppointments(
  patientId: number,
  upcoming: boolean,
  todayDateStr: string
): Promise<AppointmentRow[]> {
  const op = upcoming ? '>=' : '<';
  const order = upcoming ? 'ASC' : 'DESC';
  const result = await pool.query<AppointmentRow>(
    `SELECT * FROM appointments
     WHERE patient_id = $1 AND appointment_date ${op} $2
     ORDER BY appointment_date ${order}, token_number ${order}`,
    [patientId, todayDateStr]
  );
  return result.rows;
}

export async function findTodayForDoctor(
  doctorId: number,
  todayDateStr: string
): Promise<AppointmentRow[]> {
  const result = await pool.query<AppointmentRow>(
    `SELECT * FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2
     ORDER BY token_number ASC`,
    [doctorId, todayDateStr]
  );
  return result.rows;
}

export async function findForAdmin(doctorId: number, date: string): Promise<AppointmentRow[]> {
  const result = await pool.query<AppointmentRow>(
    `SELECT * FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2
     ORDER BY token_number ASC`,
    [doctorId, date]
  );
  return result.rows;
}

export async function existsForDoctorPatient(doctorId: number, patientId: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM appointments WHERE doctor_id = $1 AND patient_id = $2`,
    [doctorId, patientId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function completeAppointment(appointmentId: number): Promise<void> {
  await pool.query(
    `UPDATE appointments SET status = 'COMPLETED', updated_at = now()
     WHERE id = $1 AND status = 'BOOKED'`,
    [appointmentId]
  );
}

export async function getCountersForDoctorDates(
  doctorId: number,
  dates: string[]
): Promise<Map<string, number>> {
  const result = await pool.query<{ appointment_date: string | Date; booked_count: number }>(
    `SELECT appointment_date, booked_count FROM doctor_day_counters
     WHERE doctor_id = $1 AND appointment_date = ANY($2::date[])`,
    [doctorId, dates]
  );
  const map = new Map<string, number>();
  for (const row of result.rows) {
    // pg returns DATE columns as JS Date by default unless parser overridden; normalize to YYYY-MM-DD.
    const dateStr =
      row.appointment_date instanceof Date
        ? row.appointment_date.toISOString().slice(0, 10)
        : row.appointment_date;
    map.set(dateStr, row.booked_count);
  }
  return map;
}

export interface FutureCountRow {
  date: string;
  dayOfWeek: number;
  count: number;
}

export async function getFutureCounts(doctorId: number, todayStr: string): Promise<FutureCountRow[]> {
  const result = await pool.query<{ appointment_date: string | Date; booked_count: number }>(
    `SELECT appointment_date, booked_count FROM doctor_day_counters
     WHERE doctor_id = $1 AND appointment_date >= $2 AND booked_count > 0
     ORDER BY appointment_date ASC`,
    [doctorId, todayStr]
  );
  return result.rows.map((row) => {
    const dateStr =
      row.appointment_date instanceof Date
        ? (row.appointment_date as unknown as Date).toISOString().slice(0, 10)
        : (row.appointment_date as string);
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const jsDay = dt.getUTCDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    return { date: dateStr, dayOfWeek, count: row.booked_count };
  });
}
