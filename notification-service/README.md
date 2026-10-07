# notification-service (SVC-06)

Stack B — Node.js 20, Express + TypeScript, PostgreSQL (`hms_notification`), kafkajs. Port `8085`.

Stores patient-facing notifications (bell icon) and serves them through a small REST API. The only
event consumed is `appointment.booked`, published by `appointment-service`. This service never
publishes events (no outbox).

## What it does

- Consumes `appointment.booked` from Kafka (consumer group `notification-service`) and inserts a
  "Booking successful" notification row per event, idempotently (`ON CONFLICT (event_id) DO NOTHING`).
  Any failure other than the expected conflict is rethrown from the `eachMessage` handler so the
  Kafka offset is not committed and the message is redelivered (NTF-R1, NTF-R2, NTF-R3).
- Serves three APIs to the patient app (through the gateway, role `PATIENT`, `patientId` taken from
  the `X-Patient-Id` header):
  - `GET /api/v1/notifications/my?page=0&size=20` — own notifications, newest first.
  - `GET /api/v1/notifications/my/unread-count` — `{ "count": N }` for the bell badge.
  - `PATCH /api/v1/notifications/{id}/read` — mark one as read; idempotent; 404 `NTF_NOT_FOUND` if
    the notification does not exist or belongs to another patient (NTF-R4, NTF-R5).

## Project layout

```
src/
  config/env.ts              Env var loading with defaults
  db/pool.ts                 pg Pool
  events/
    types.ts                 Kafka envelope + appointment.booked payload types
    messageTemplate.ts       Renders the notification message template
    appointmentBookedHandler.ts  NTF-R1..R3 business logic (pure, pg-free)
    consumer.ts               kafkajs wiring (consumer group, subscribe, eachMessage)
  repositories/notificationRepository.ts  SQL (insert-if-new, list, counts, mark-read)
  services/notificationService.ts         DTO mapping, ownership enforcement (NTF-R4/R5)
  routes/notificationRoutes.ts            Express router + zod validation
  middleware/patientContext.ts            Reads X-Patient-Id header
  utils/BusinessError.ts, respond.ts      Error type + envelope helpers
  app.ts                      Express app wiring + error handler
  server.ts                   Entry point: starts HTTP server + Kafka consumer
migrations/                  node-pg-migrate migrations
test/                        Vitest + Supertest tests
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8085` | HTTP port |
| `PGHOST` | `localhost` | PostgreSQL host |
| `PGPORT` | `5432` | PostgreSQL port |
| `PGDATABASE` | `hms_notification` | PostgreSQL database |
| `PGUSER` | `notification_service` | PostgreSQL user |
| `PGPASSWORD` | `notification_service_pw` | PostgreSQL password |
| `KAFKA_BOOTSTRAP` | `localhost:9092` | Kafka bootstrap servers |

These match the values wired into the root `docker-compose.yml`.

## Run locally

```bash
npm install
npm run migrate:up     # applies migrations/ against PGDATABASE
npm run dev            # ts-node-dev, auto-reload
# or
npm run build && npm start
```

Requires a reachable PostgreSQL (`hms_notification` database) and Kafka broker; both are provided by
the root `docker-compose.yml` (`postgres`, `kafka` services).

## Test

```bash
npm test          # vitest run — unit + API tests, no real DB/Kafka required (pg Pool and the
                   # repository/service are mocked in tests)
npm run test:watch
```

Covered:
- API handlers (Supertest): missing `X-Patient-Id` → 403, pagination defaults/validation, ownership
  (patientId always taken from the header, never the body/path), mark-read idempotency, 404
  `NTF_NOT_FOUND` for a non-numeric id or another patient's notification.
- `NotificationService`: DTO mapping (camelCase), `NTF_NOT_FOUND` thrown on missing ownership match.
- `NotificationRepository`: idempotent insert (`ON CONFLICT`), mark-read fallback-to-select logic,
  propagation of DB errors.
- `handleAppointmentBooked` (Kafka logic, `pg` fully mocked out via a fake repository): exact message
  template rendering (including 12-hour clock edge cases), NTF-R1 insert fields, NTF-R2 idempotent
  no-throw on duplicate, NTF-R3 rethrow on failure.

## Migrate

```bash
npm run migrate:up     # apply all pending migrations
npm run migrate:down   # roll back the last migration
```

`node-pg-migrate` reads `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` from the environment
(via `DATABASE_URL` is also supported, but this project relies on the discrete `PG*` vars already
used by `pg`).

## Build

```bash
npm run build       # tsc -> dist/
npm run typecheck   # tsc --noEmit
```

## Docker

Multi-stage `Dockerfile`: installs dependencies and compiles TypeScript in a `node:20-slim` build
stage, then copies `dist/` and `migrations/` into a slim runtime stage that installs only production
dependencies. Exposes `8085`.

## Notes / deviations from spec

- The spec's `appointment.booked` payload gives `appointmentDate` and `reportingTime` without an
  explicit wire format. This implementation accepts either a plain `YYYY-MM-DD` / `HH:mm[:ss]` value
  or a full ISO-8601 timestamp for either field, and always renders `dd-MM-yyyy` / `hh:mm a` in the
  stored message, matching the example in §4 of SVC-06 exactly byte-for-byte for the sample payload.
- `node-pg-migrate` needs a `DATABASE_URL`-style connection in some setups; here it is driven purely
  by the standard `PG*` environment variables (same convention `pg` itself uses), so no extra
  `DATABASE_URL` wiring was added to docker-compose.
