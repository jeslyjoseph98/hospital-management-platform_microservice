# HMS Microservices — SVC-06 notification-service

Version: 2.0
Stack: B — Node.js 20 (Express + TypeScript) · Port: 8085 · Database: PostgreSQL `hms_notification`

## 1. Purpose

Stores patient notifications created from events and serves the patient's notification list (bell icon). No email/SMS in v1.

## 2. How "Booking successful" reaches the patient

1. **Immediately:** the booking response from appointment-service has `"message": "Booking successful"`; the frontend shows it as a toast.
2. **Stored:** appointment-service publishes `appointment.booked`; this service consumes it and inserts a notification, usually within a few seconds.

## 3. Table (PostgreSQL, migrations with node-pg-migrate)

```sql
CREATE TABLE notifications (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id        UUID         NOT NULL UNIQUE,   -- from the Kafka envelope; stops duplicates
  patient_id      BIGINT       NOT NULL,          -- id in user-service
  title           VARCHAR(100) NOT NULL,
  message         VARCHAR(500) NOT NULL,
  appointment_id  BIGINT,                         -- id in appointment-service
  is_read         BOOLEAN      NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_ntf_patient ON notifications (patient_id, is_read, created_at DESC);
```

No outbox (this service publishes nothing).

## 3A. Implementation (Stack B — Node.js)

Same setup as appointment-service (SVC-04 §2A): Node.js 20, Express + TypeScript, `pg`, zod, kafkajs consumer group `notification-service`. The consumer and the HTTP API run in the same process.

## 4. Event Consumed

`appointment.booked`, consumer group `notification-service`.

Payload: `{ appointmentId, appointmentCode, patientId, doctorName, departmentName, appointmentDate, tokenNumber, reportingTime }`

| ID | Rule |
|----|------|
| NTF-R1 | Insert one row: `title = "Booking successful"`, `message` from the template below, `event_id` from the envelope. |
| NTF-R2 | Insert with `ON CONFLICT (event_id) DO NOTHING`. 0 rows inserted → already processed; commit the offset and move on (safe to run twice). |
| NTF-R3 | Any other failure → throw from the kafkajs `eachMessage` handler so the offset is not committed; Kafka redelivers. |

Message template:
`Your appointment with {doctorName} ({departmentName}) on {dd-MM-yyyy} is confirmed. Token No: {tokenNumber}. Please report by {hh:mm a}.`

Example: *Your appointment with Dr. Rahul Menon (Cardiology) on 28-09-2026 is confirmed. Token No: 17. Please report by 10:48 AM.*

## 5. Public APIs (through gateway, role PATIENT)

`patientId` from header `X-Patient-Id`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/notifications/my?page=0&size=20 | Own notifications, newest first |
| GET | /api/v1/notifications/my/unread-count | `{ "count": 2 }` for the bell badge |
| PATCH | /api/v1/notifications/{id}/read | Mark one as read (`is_read = true`, `read_at = now()`) |

| ID | Rule |
|----|------|
| NTF-R4 | A patient sees and updates only own notifications; another patient's id → 404 `NTF_NOT_FOUND`. |
| NTF-R5 | Marking an already-read notification is allowed and changes nothing. |

## 6. Error Codes

`NTF_NOT_FOUND`
