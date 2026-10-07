# HMS Microservices — SVC-00 Platform and Conventions

Version: 2.0 (polyglot: three technology stacks)
Read this first. Every service spec (SVC-01 to SVC-07) follows the rules here.

## 1. System Summary

Hospital appointment system with one portal and four roles:

| Role | What they do |
|------|--------------|
| PATIENT | Register, pick department → doctor → date, book (max 50 per doctor per day), get token number and reporting time, see notifications, view consultation and prescription after the visit |
| ADMIN | Maintain departments and doctors (profile, qualification, consultation fee, daily limit, weekly timings), view bookings |
| DOCTOR | See today's appointments, open patient details and history, record consultation and prescription, complete the visit |
| PHARMACIST | See prescriptions, give medicines, mark as done |

Out of scope: cancellation/rescheduling, lab tests, billing, medicine stock, SMS/email.

## 2. Technology Stacks and Services

The system uses three stacks. Each stack has its own backend language, its own database type, and its own frontend app for one group of users.

| Stack | Backend | Database | Frontend | Users of the frontend |
|-------|---------|----------|----------|-----------------------|
| **A** | Spring Boot (Java 21) | MySQL 8 | React (Vite + TypeScript) — `admin-web` | Admin |
| **B** | Node.js 20 (Express + TypeScript) | PostgreSQL 16 | Flutter — `patient-app` (Android, iOS, web) | Patient |
| **C** | Python 3.12 (FastAPI) | MongoDB 7 | Next.js (TypeScript) — `clinic-web` | Doctor, Pharmacist |

| Spec | Component | Stack | Port | Database |
|------|-----------|-------|------|----------|
| SVC-01 | api-gateway | A (Spring Cloud Gateway) | 8080 | — |
| SVC-02 | user-service | A | 8081 | MySQL `hms_user` |
| SVC-03 | doctor-service | A | 8082 | MySQL `hms_doctor` |
| SVC-04 | appointment-service | B | 8083 | PostgreSQL `hms_appointment` |
| SVC-05 | consultation-service | C | 8084 | MongoDB `hms_consultation` |
| SVC-06 | notification-service | B | 8085 | PostgreSQL `hms_notification` |
| SVC-07A | admin-web | A (React) | 5173 | — |
| SVC-07B | patient-app | B (Flutter) | 8090 (web build) | — |
| SVC-07C | clinic-web | C (Next.js) | 3000 | — |

Why this split:
- **Stack A** owns accounts and master data (users, doctors, departments). Relational, strict, low write volume — a good fit for Spring Boot + MySQL, and the admin manages it through React.
- **Stack B** owns booking and notifications: the concurrency-critical part (50-per-day lock) and the patient's main journey. PostgreSQL has strong row locking and `ON CONFLICT`; Node handles many small requests well; Flutter gives patients a mobile app.
- **Stack C** owns consultations. A consultation with its vitals and prescription list is naturally one document, which fits MongoDB; doctors and pharmacists use it on desktop through Next.js.

Same login, based on role: all three apps call the same `POST /auth/login` (user-service). Each app offers only its own roles in the **Login as** / **Register as** dropdown, and rejects a token with a role it does not serve (section 6 of each frontend spec).

```
   admin-web (React)        patient-app (Flutter)        clinic-web (Next.js)
          └──────────────────────────┼─────────────────────────────┘
                                     ▼
                     api-gateway :8080 (Spring Cloud Gateway)
                 JWT check · role check · X-User-* headers
     ┌───────────────┬───────────────┼────────────────┬──────────────────┐
     ▼               ▼               ▼                ▼                  ▼
 user-service   doctor-service  appointment-svc  consultation-svc  notification-svc
 Spring/MySQL   Spring/MySQL    Node/Postgres    Python/MongoDB    Node/Postgres
     │               │               │                │                  │
  hms_user       hms_doctor     hms_appointment  hms_consultation  hms_notification

  Sync REST (/internal/**, JSON over HTTP — language independent)
  user → doctor (verify registration)        appointment → doctor (weekly schedule)
  appointment → user (patient details)       doctor → appointment (future counts)
  consultation → appointment (appointment)   consultation → user (patient details)

  Kafka topics (JSON messages — language independent)
  user.doctor-account-registered  user → doctor
  doctor.status-changed           doctor → user
  appointment.booked              appointment → notification
  consultation.completed          consultation → appointment
```

## 3. Architecture Rules

| ID | Rule |
|----|------|
| MS-R1 | Each service reads and writes only its own database. No cross-database joins, no foreign keys to another service's tables. IDs from other services are stored as plain `BIGINT`. |
| MS-R2 | Data another service owns is either fetched with a sync call, or copied as a **snapshot** column when the record is created (e.g. `doctor_name` on an appointment). Snapshots are not updated later. |
| MS-R3 | Use a sync call when the answer decides whether to accept the request. Use an event when the other service only needs to know something happened. |
| MS-R4 | Sync calls (any stack, see §4 for the client library): connect timeout 2 s, read timeout 5 s. If the called service is down, times out, or returns 5xx → respond 503 `SERVICE_UNAVAILABLE` and save nothing. |
| MS-R5 | `/internal/**` endpoints are only for service-to-service calls. The gateway has no route to them. Services run on an internal Docker network; only the gateway port is published. |
| MS-R6 | Services find each other by Docker Compose service name, e.g. `http://doctor-service:8082`. Base URLs come from `application.yml`. |
| MS-R7 | Business services do not validate the JWT. They trust the `X-User-*` headers set by the gateway (section 6). |
| MS-R8 | Every request carries `X-Request-Id` (set by the gateway). Services log it and pass it on in sync calls and in Kafka message headers. |

## 4. Technology per Stack

| Concern | Stack A (Spring Boot) | Stack B (Node.js) | Stack C (Python) |
|---------|-----------------------|-------------------|------------------|
| Framework | Spring Boot 3.x | Express 4 + TypeScript | FastAPI |
| Validation | Jakarta Bean Validation | zod | Pydantic v2 |
| Data access | MyBatis (XML mappers) | `pg` (node-postgres), plain SQL | Motor (async MongoDB driver) |
| Schema / migrations | Flyway | node-pg-migrate | Startup script creates collections + indexes |
| HTTP client (sync calls) | Spring `RestClient` | built-in `fetch` + `AbortController` | `httpx.AsyncClient` |
| Kafka | Spring for Apache Kafka | kafkajs | aiokafka |
| Scheduled outbox job | `@Scheduled(fixedDelay = 2000)` | `setInterval` (2 s, skip if previous run still busy) | `asyncio` background task (2 s loop) |
| Password hashing | BCrypt (Spring Security) | — | — |
| Tests | JUnit 5, Mockito, Testcontainers | Vitest/Jest, Supertest, Testcontainers | pytest, httpx test client, Testcontainers |

Frontends:

| App | Tech |
|-----|------|
| admin-web | React 18 + Vite + TypeScript, React Router, fetch/axios |
| patient-app | Flutter 3 (Dart), `http` or `dio`, `provider` or `riverpod` for state, `flutter_secure_storage` for the token |
| clinic-web | Next.js 14 (App Router) + TypeScript |

## 5. Coding and Data Conventions

Common:
- Business rules are plain if-checks in the service layer, one check per rule, each raising a business error with `errorCode` and HTTP status.
- IDs from other services are stored as plain numbers (no foreign keys across services).
- Times stored in UTC; dates as date-only values. "Today" and day boundaries are always computed in the hospital time zone `Asia/Kolkata` in every service and language, so Java, Node and Python agree on what today is.
- Each service has its own copies of event payload classes/types. No shared library.
- Layers per service: controller/router → service → repository/mapper; plus `client` (sync calls) and `event` (outbox publisher, Kafka consumers).

Per database:

| Item | MySQL (A) | PostgreSQL (B) | MongoDB (C) |
|------|-----------|----------------|-------------|
| Primary key | `BIGINT AUTO_INCREMENT` | `BIGINT GENERATED ALWAYS AS IDENTITY` | `_id` ObjectId (sent to clients as string) |
| Timestamps | `DATETIME`, `ON UPDATE CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT now()`; `updated_at` set in SQL by the code | `createdAt` / `updatedAt` as `Date`, set by the code |
| Status values | `VARCHAR(20)` + `CHECK` | `VARCHAR(20)` + `CHECK` | String; allowed values enforced by Pydantic `Literal` |
| Money | `DECIMAL(10,2)` | `NUMERIC(10,2)` | — (no money in stack C) |
| Names | `snake_case` | `snake_case` | `camelCase` fields |
| JSON API fields | camelCase | camelCase | camelCase |

MySQL must be 8.0.16+ so `CHECK` constraints are enforced. MongoDB must run as a **replica set** (single node is fine locally) because the outbox needs multi-document transactions.

## 6. Headers Set by the Gateway

| Header | Value | Present for |
|--------|-------|-------------|
| `X-User-Id` | user id | all logged-in requests |
| `X-User-Role` | PATIENT / ADMIN / DOCTOR / PHARMACIST | all logged-in requests |
| `X-User-Name` | full name | all logged-in requests |
| `X-Patient-Id` | patient id | PATIENT |
| `X-Doctor-Id` | doctor id | DOCTOR |
| `X-Request-Id` | UUID | every request |

Services take patient id and doctor id from these headers, never from the request body.

## 7. API Response Format

Base path `/api/v1`, JSON, camelCase.

Success:
```json
{ "success": true, "data": { }, "message": "Booking successful" }
```

Error:
```json
{ "success": false, "errorCode": "APT_DOCTOR_FULLY_BOOKED", "message": "Dr. Rahul Menon is fully booked on 28-09-2026", "fieldErrors": [], "data": null }
```

`fieldErrors`: `[ { "field": "phone", "message": "Phone is required" } ]`.

| HTTP | When |
|------|------|
| 400 | Validation failure (`fieldErrors` filled) |
| 401 | No / invalid / expired token |
| 403 | Wrong role |
| 404 | Not found, or belongs to another user |
| 409 | Business rule failed |
| 503 | A service this request depends on is unavailable |

Common error codes: `AUTH_TOKEN_INVALID`, `AUTH_FORBIDDEN`, `SERVICE_UNAVAILABLE`, `VALIDATION_FAILED`.

## 8. Kafka Events

### 8.1 Envelope

```json
{
  "eventId": "6f1c2a0e-4b7d-4e55-9c1a-2f7b1d9e8a10",
  "eventType": "appointment.booked",
  "occurredAt": "2026-09-28T10:15:30Z",
  "payload": { }
}
```

Message key = the main id of the record (doctorId, appointmentId, consultationId) so events about one record stay in order.

### 8.2 Topics

| Topic | Producer | Consumer | Spec |
|-------|----------|----------|------|
| `user.doctor-account-registered` | user-service | doctor-service | SVC-02, SVC-03 |
| `doctor.status-changed` | doctor-service | user-service | SVC-03, SVC-02 |
| `appointment.booked` | appointment-service | notification-service | SVC-04, SVC-06 |
| `consultation.completed` | consultation-service | appointment-service | SVC-05, SVC-04 |

Topics are created at startup (3 partitions, replication 1 for local). Consumer group = service name.

### 8.3 Outbox (every producing service)

Producers never call Kafka inside the business transaction. They write an outbox record in the **same transaction** as the business change; a scheduled job publishes it.

MySQL (user-service, doctor-service):
```sql
CREATE TABLE outbox_events (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id     CHAR(36)     NOT NULL UNIQUE,
  topic        VARCHAR(100) NOT NULL,
  message_key  VARCHAR(50)  NOT NULL,
  payload      JSON         NOT NULL,
  status       VARCHAR(10)  NOT NULL DEFAULT 'NEW',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at      DATETIME     NULL,
  CONSTRAINT chk_ob_status CHECK (status IN ('NEW','SENT')),
  INDEX idx_ob_new (status, id)
) ENGINE=InnoDB;
```

PostgreSQL (appointment-service):
```sql
CREATE TABLE outbox_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id     UUID         NOT NULL UNIQUE,
  topic        VARCHAR(100) NOT NULL,
  message_key  VARCHAR(50)  NOT NULL,
  payload      JSONB        NOT NULL,
  status       VARCHAR(10)  NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','SENT')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ  NULL
);
CREATE INDEX idx_ob_new ON outbox_events (status, id);
```

MongoDB (consultation-service), collection `outbox_events`:
```json
{ "_id": "ObjectId", "eventId": "uuid", "topic": "consultation.completed", "messageKey": "45",
  "payload": { }, "status": "NEW", "createdAt": "Date", "sentAt": null }
```
Indexes: `{ eventId: 1 }` unique, `{ status: 1, createdAt: 1 }`.

| ID | Rule |
|----|------|
| OB-R1 | Publisher job every 2 seconds: oldest 50 records with `status = NEW`. |
| OB-R2 | For each: send and wait for the Kafka ack. Ack OK → `status = SENT`, `sent_at = now`. Failure → stop this run; retry next run. |
| OB-R3 | A record can be sent more than once (crash after send, before update). Every consumer must be safe to run twice; each consumer rule says how. |

Why: sending to Kafka inside the transaction can leave a saved booking with no event, or an event for a booking that rolled back.

## 9. Repository and Local Run

```
hms/
 ├── api-gateway/            Stack A  Spring Cloud Gateway
 ├── user-service/           Stack A  Spring Boot + MySQL
 ├── doctor-service/         Stack A  Spring Boot + MySQL
 ├── appointment-service/    Stack B  Node.js + PostgreSQL
 ├── notification-service/   Stack B  Node.js + PostgreSQL
 ├── consultation-service/   Stack C  Python FastAPI + MongoDB
 ├── admin-web/              Stack A  React
 ├── patient-app/            Stack B  Flutter
 ├── clinic-web/             Stack C  Next.js
 ├── docker/
 │    ├── mysql-init.sql      CREATE DATABASE hms_user; CREATE DATABASE hms_doctor;
 │    ├── postgres-init.sql   CREATE DATABASE hms_appointment; CREATE DATABASE hms_notification;
 │    └── mongo-init.js       rs.initiate() for single-node replica set
 └── docker-compose.yml
```

| Container | Notes |
|-----------|-------|
| mysql | mysql:8.0, runs `mysql-init.sql`; one DB user per service |
| postgres | postgres:16, runs `postgres-init.sql`; one DB user per service |
| mongo | mongo:7 started with `--replSet rs0`; `mongo-init.js` runs `rs.initiate()` |
| kafka | apache/kafka, KRaft single broker |
| api-gateway | only backend port published to the host (8080) |
| 5 business services | env: own DB connection, `KAFKA_BOOTSTRAP`, other service URLs; `HMS_JWT_SECRET` for user-service and gateway |
| admin-web / clinic-web | `API_URL=http://localhost:8080/api/v1` |
| patient-app | run with `flutter run`; `--dart-define=API_URL=http://10.0.2.2:8080/api/v1` on Android emulator, `http://localhost:8080/api/v1` for web |

## 10. Build Order

| Step | Build | Stack | Proves |
|------|-------|-------|--------|
| 1 | api-gateway + user-service | A | Register, login, role routing, 401/403 |
| 2 | doctor-service + admin-web (departments, doctors) | A | Database per service behind one gateway |
| 3 | appointment-service, sync calls only | B | A Node service calling Spring services; 50 limit, tokens; 503 when doctor-service is down |
| 4 | patient-app: register, login, book | B | Flutter talking to the same gateway |
| 5 | Kafka + outbox (appointment) + notification-service | B | Events between Node services; notification survives restarts |
| 6 | Doctor registration link (sync verify + 2 events) | A | Events between Spring services |
| 7 | consultation-service + clinic-web (doctor) | C | Python + MongoDB; `consultation.completed` consumed by Node |
| 8 | Pharmacy endpoints + clinic-web (pharmacist) | C | Mark as done |
