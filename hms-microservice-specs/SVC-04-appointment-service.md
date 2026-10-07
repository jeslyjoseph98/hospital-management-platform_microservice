# HMS Microservices — SVC-04 appointment-service

Version: 2.0
Stack: B — Node.js 20 (Express + TypeScript) · Port: 8083 · Database: PostgreSQL `hms_appointment`

## 1. Purpose

Owns appointment booking: doctor availability for the next 7 days, the daily limit (default 50 per doctor per day), token numbers, estimated reporting time, appointment status. Also serves the doctor's today list and the admin bookings view.

## 2. Tables (PostgreSQL, migrations with node-pg-migrate)

```sql
CREATE TABLE appointments (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_code    VARCHAR(20)  UNIQUE,               -- APT00000045, set right after insert
  patient_id          BIGINT       NOT NULL,             -- id in user-service
  doctor_id           BIGINT       NOT NULL,             -- id in doctor-service
  appointment_date    DATE         NOT NULL,
  token_number        INT          NOT NULL CHECK (token_number >= 1),
  reporting_time      TIME         NOT NULL,
  reason              VARCHAR(300),
  status              VARCHAR(20)  NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED','COMPLETED')),
  -- snapshots copied at booking time (SVC-00 MS-R2)
  patient_name        VARCHAR(100) NOT NULL,
  patient_code        VARCHAR(20)  NOT NULL,
  patient_gender      VARCHAR(10)  NOT NULL,
  patient_dob         DATE         NOT NULL,
  doctor_name         VARCHAR(100) NOT NULL,
  department_name     VARCHAR(100) NOT NULL,
  consultation_start  TIME         NOT NULL,
  consultation_end    TIME         NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ,                       -- set in UPDATE statements: updated_at = now()
  CONSTRAINT uq_apt_token   UNIQUE (doctor_id, appointment_date, token_number),
  CONSTRAINT uq_apt_patient UNIQUE (patient_id, doctor_id, appointment_date)
);
CREATE INDEX idx_apt_patient     ON appointments (patient_id, appointment_date);
CREATE INDEX idx_apt_doctor_date ON appointments (doctor_id, appointment_date);

-- Lock row + count per doctor per date. Booking locks this row so two
-- requests for the last spot can't both succeed.
CREATE TABLE doctor_day_counters (
  doctor_id         BIGINT NOT NULL,
  appointment_date  DATE   NOT NULL,
  booked_count      INT    NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, appointment_date)
);
```

Plus `outbox_events` (PostgreSQL version, SVC-00 §8.3).

`booked_count` counts BOOKED and COMPLETED appointments. It is never decreased in v1 (no cancellation), so finished consultations don't reopen spots.

## 2A. Implementation (Stack B — Node.js)

| Item | Choice |
|------|--------|
| Runtime / framework | Node.js 20, Express 4, TypeScript |
| DB | `pg` Pool; transactions with one pooled client: `BEGIN` … `COMMIT` / `ROLLBACK` in `try/finally` |
| Validation | zod schema per request body |
| Sync calls | `fetch` with `AbortController` (2 s connect / 5 s total); non-2xx or abort → `SERVICE_UNAVAILABLE` (except 404, which maps to the rule's own error) |
| Kafka | kafkajs producer (outbox job) and consumer group `appointment-service` |
| Outbox job | `setInterval` every 2 s; a boolean `running` flag skips a tick if the previous run is still busy |
| Folders | `src/routes`, `src/services`, `src/repositories` (SQL), `src/clients`, `src/events`, `migrations/` |
| Errors | `class BusinessError { code, status }`; one Express error middleware writes the standard JSON (SVC-00 §7) |
| Postgres unique violation | error code `23505`; check `err.constraint` (`uq_apt_token` / `uq_apt_patient`) |

## 3. Status Flow

```
BOOKED ──► COMPLETED    (on event consultation.completed)
```

## 4. Availability

`GET /api/v1/doctors/{id}/availability` — for today and the next 6 days:

1. Call doctor-service `GET /internal/doctors/{id}/weekly-schedule`. 404 or `active = false` → 404 `DOC_NOT_FOUND`.
2. Read `doctor_day_counters` for this doctor and the 7 dates in one query.
3. For each date:
   - No timing for that weekday → `NOT_AVAILABLE`.
   - `booked` = `booked_count` (0 if no row); `remaining = dailyLimit - booked`.
   - Date is today and current time ≥ `endTime` → `CLOSED`.
   - Else `remaining <= 0` → `FULLY_BOOKED`.
   - Else → `AVAILABLE`.

```json
GET /api/v1/doctors/3/availability
{
  "success": true,
  "data": {
    "doctorId": 3, "doctorName": "Dr. Rahul Menon", "dailyLimit": 50,
    "dates": [
      { "date": "2026-09-28", "day": "MONDAY",    "startTime": "10:00", "endTime": "13:00", "booked": 38, "remaining": 12, "status": "AVAILABLE" },
      { "date": "2026-09-29", "day": "TUESDAY",   "status": "NOT_AVAILABLE" },
      { "date": "2026-09-30", "day": "WEDNESDAY", "startTime": "14:00", "endTime": "17:00", "booked": 50, "remaining": 0, "status": "FULLY_BOOKED" }
    ]
  }
}
```

## 5. Booking

### 5.1 Rules

| ID | Rule |
|----|------|
| APT-R1 | `patientId` from header `X-Patient-Id`. |
| APT-R2 | `doctorId` and `appointmentDate` required → 400 `VALIDATION_FAILED`. `reason` optional, max 300. |
| APT-R3 | Doctor must exist and be active (weekly-schedule call) → `DOC_NOT_FOUND`. |
| APT-R4 | Date between today and today + 6 → `APT_DATE_OUT_OF_RANGE`. |
| APT-R5 | Doctor must have a timing on that weekday → `APT_DOCTOR_NOT_AVAILABLE`. |
| APT-R6 | Date is today and current time ≥ `endTime` → `APT_BOOKING_CLOSED`. |
| APT-R7 | Patient already has an appointment with this doctor on this date → `APT_ALREADY_BOOKED`. |
| APT-R8 | `booked_count >= dailyLimit` → `APT_DOCTOR_FULLY_BOOKED` ("Dr. X is fully booked on dd-MM-yyyy. Please choose another date."). |
| APT-R9 | `token_number = booked_count + 1`. |
| APT-R10 | `minutesPerPatient = FLOOR((endTime − startTime in minutes) / dailyLimit)`, minimum 1. `reporting_time = startTime + (token_number − 1) × minutesPerPatient`. Example: 10:00–13:00, limit 50 → 3 min; token 17 → 10:48. |
| APT-R11 | Patient sees only own appointments; another patient's id → 404 `APT_NOT_FOUND`. |

### 5.2 Steps

```
 1. Validate request (APT-R2)
 2. Call doctor-service  GET /internal/doctors/{doctorId}/weekly-schedule      (APT-R3)
 3. Date checks APT-R4, R5, R6 with the timing for the date's weekday
 4. Call user-service    GET /internal/patients/{patientId}                    (snapshot data)
 5. BEGIN
 6. INSERT INTO doctor_day_counters (doctor_id, appointment_date) VALUES ($1, $2)
      ON CONFLICT (doctor_id, appointment_date) DO NOTHING
 7. SELECT booked_count FROM doctor_day_counters
      WHERE doctor_id = $1 AND appointment_date = $2 FOR UPDATE
 8. APT-R7: SELECT 1 FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND appointment_date = $3
 9. APT-R8: if booked_count >= dailyLimit → rollback, APT_DOCTOR_FULLY_BOOKED
10. token_number = booked_count + 1; reporting_time per APT-R10
11. INSERT INTO appointments (...) VALUES (...) RETURNING id
12. UPDATE appointments SET appointment_code = 'APT' || LPAD(id::text, 8, '0') WHERE id = $1
13. UPDATE doctor_day_counters SET booked_count = booked_count + 1 WHERE doctor_id = $1 AND appointment_date = $2
14. INSERT outbox_events  appointment.booked
15. COMMIT
```

- Steps 2 and 4 run before the transaction so the row lock (step 7) is held only for fast local work.
- With the lock, a second request for the 50th spot waits, then reads 50 and is rejected. `uq_apt_token` and `uq_apt_patient` are a second safety net: a unique-violation error (`23505`) maps to `APT_DOCTOR_FULLY_BOOKED` / `APT_ALREADY_BOOKED`.
- `dailyLimit` comes from step 2. If the admin changes the limit at the same moment, this booking uses the value it read; acceptable for v1.

### 5.3 Book API

```json
POST /api/v1/appointments
{ "doctorId": 3, "appointmentDate": "2026-09-28", "reason": "Chest pain on exertion" }
```

Response `201`:
```json
{
  "success": true,
  "message": "Booking successful",
  "data": {
    "appointmentId": 45, "appointmentCode": "APT00000045",
    "tokenNumber": 17, "reportingTime": "10:48", "appointmentDate": "2026-09-28",
    "doctorName": "Dr. Rahul Menon", "departmentName": "Cardiology", "consultationTimings": "10:00 - 13:00",
    "patientName": "John Mathew", "patientCode": "PAT000123", "status": "BOOKED"
  }
}
```

The frontend shows "Booking successful" as a toast from this response immediately; the stored notification arrives via notification-service a few seconds later.

## 6. Doctor's Today List

`GET /api/v1/doctor/appointments/today` (role DOCTOR, `doctorId` from `X-Doctor-Id`):

| ID | Rule |
|----|------|
| DTL-R1 | `appointment_date = CURDATE()` and `doctor_id` = header, ordered by `token_number`. |
| DTL-R2 | Row: appointmentId, token, reporting time, patient id, name, code, age (from `patient_dob`), gender, status (BOOKED / COMPLETED). |
| DTL-R3 | Counts: total, completed, pending (BOOKED). |

```json
{
  "success": true,
  "data": {
    "date": "2026-09-28", "total": 38, "completed": 12, "pending": 26,
    "appointments": [
      { "appointmentId": 45, "tokenNumber": 17, "reportingTime": "10:48", "patientId": 123,
        "patientName": "John Mathew", "patientCode": "PAT000123", "age": 38, "gender": "MALE", "status": "BOOKED" }
    ]
  }
}
```

"In progress" is not shown here; that state lives in consultation-service.

## 7. Admin Bookings View

`GET /api/v1/admin/appointments?doctorId=&date=` (role ADMIN) returns `booked` (count for that date) and the list of tokens with patient name, code, reporting time and status. The daily limit is not stored in this service; the admin screen already has it from doctor-service and shows "38 / 50".

## 8. Public APIs (through gateway)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/v1/doctors/{id}/availability | PATIENT | Section 4 |
| POST | /api/v1/appointments | PATIENT | Book (section 5) |
| GET | /api/v1/appointments/my?upcoming=true | PATIENT | Own appointments; `upcoming=false` for past |
| GET | /api/v1/appointments/{id} | PATIENT | Own booking slip |
| GET | /api/v1/doctor/appointments/today | DOCTOR | Section 6 |
| GET | /api/v1/admin/appointments?doctorId=&date= | ADMIN | Section 7 |

## 9. Internal APIs (provided)

| Method | Path | Used by | Response |
|--------|------|---------|----------|
| GET | /internal/appointments/{id} | consultation-service | Full appointment row including snapshots; 404 |
| GET | /internal/appointments/exists?doctorId=&patientId= | consultation-service | `{ "exists": true }` |
| GET | /internal/appointments/future-counts?doctorId= | doctor-service | `[ { "date": "2026-10-02", "dayOfWeek": 5, "count": 14 } ]` — dates ≥ today with count > 0, from `doctor_day_counters` |

## 10. Calls Made

| Call | When |
|------|------|
| doctor-service `GET /internal/doctors/{id}/weekly-schedule` | Availability, booking |
| user-service `GET /internal/patients/{id}` | Booking (snapshots) |

## 11. Events

| Direction | Topic | Payload / action |
|-----------|-------|------------------|
| Publishes (outbox) | `appointment.booked` | `{ appointmentId, appointmentCode, patientId, doctorName, departmentName, appointmentDate, tokenNumber, reportingTime }` |
| Consumes | `consultation.completed` (from the Python service) | Payload `{ consultationId (string), appointmentId (number) }`. `UPDATE appointments SET status = 'COMPLETED', updated_at = now() WHERE id = $1 AND status = 'BOOKED'`. Safe to run twice. |

## 12. Error Codes

`VALIDATION_FAILED`, `DOC_NOT_FOUND`, `APT_DATE_OUT_OF_RANGE`, `APT_DOCTOR_NOT_AVAILABLE`, `APT_BOOKING_CLOSED`, `APT_ALREADY_BOOKED`, `APT_DOCTOR_FULLY_BOOKED`, `APT_NOT_FOUND`, `SERVICE_UNAVAILABLE`
