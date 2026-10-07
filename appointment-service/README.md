# appointment-service (SVC-04)

Node.js 20 + Express + TypeScript + PostgreSQL service that owns appointment booking: doctor
availability for the next 7 days, the daily booking limit (default 50 per doctor per day), token
numbers, estimated reporting time, and appointment status. Also serves the doctor's today list and
the admin bookings view. Part of the HMS microservices platform — see
`hms-microservice-specs/SVC-00-platform-and-conventions.md` and
`hms-microservice-specs/SVC-04-appointment-service.md` for the full spec this implements.

## Tech

- Node.js 20, Express 4, TypeScript (strict mode)
- PostgreSQL 16 via `pg` (node-postgres) — plain SQL, no ORM
- Migrations: `node-pg-migrate`
- Validation: `zod`
- Sync HTTP calls to other services: built-in `fetch` + `AbortController` (2s connect / 5s total
  timeout)
- Kafka: `kafkajs` (outbox publisher + `consultation.completed` consumer)
- Tests: Vitest + Supertest

## Folder layout

```
src/
  app.ts                 Express app wiring (middleware + routers)
  server.ts              Process entrypoint: HTTP server + Kafka producer/consumer bootstrap
  config/env.ts           Env var reading with the documented defaults
  db/pool.ts              pg Pool + withTransaction() helper + BIGINT/DATE type parsers
  routes/                 publicRoutes.ts (/api/v1/**), internalRoutes.ts (/internal/**)
  services/               availabilityService, bookingService, appointmentQueryService,
                          consultationCompletedService — business rules live here
  repositories/           appointmentRepository.ts, outboxRepository.ts — all SQL
  clients/                httpClient.ts (shared timeout/error mapping), doctorServiceClient.ts,
                          userServiceClient.ts
  events/                 kafka.ts (client), outboxPublisher.ts (setInterval job),
                          consultationCompletedConsumer.ts
  middleware/             headers.ts (X-User-*/X-Patient-Id/X-Doctor-Id/X-Request-Id), 
                          errorHandler.ts (standard envelope), roleGuard.ts
  schemas/                zod request schemas
  utils/                  BusinessError, datetime helpers (Asia/Kolkata "today")
migrations/               node-pg-migrate migrations (appointments, doctor_day_counters, outbox_events)
test/                     Vitest unit + API tests
```

## Environment variables

| Var | Default (if unset) | Meaning |
|-----|---------------------|---------|
| `PORT` | `8083` | HTTP port |
| `PGHOST` | `localhost` | Postgres host |
| `PGPORT` | `5432` | Postgres port |
| `PGDATABASE` | `hms_appointment` | Postgres database name |
| `PGUSER` | `appointment_service` | Postgres user |
| `PGPASSWORD` | `appointment_service_pw` | Postgres password |
| `DOCTOR_SERVICE_URL` | `http://localhost:8082` | Base URL for doctor-service sync calls |
| `USER_SERVICE_URL` | `http://localhost:8081` | Base URL for user-service sync calls |
| `KAFKA_BOOTSTRAP` | `localhost:9092` | Kafka bootstrap servers (comma-separated) |

These match the values wired into the platform's `docker-compose.yml` exactly.

## Running locally (outside Docker)

```bash
npm install

# Point PG* at a running Postgres 16 instance with database hms_appointment created, then:
npm run migrate:up      # applies migrations/ (node-pg-migrate up)

npm run dev             # ts-node-dev, auto-reload
# or
npm run build && npm start
```

`npm run migrate:up` reads `DATABASE_URL`. If you only have the discrete `PG*` vars set (as in
docker-compose), export it first, e.g.:

```bash
export DATABASE_URL="postgres://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE"
npm run migrate:up
```

## Running in Docker

The provided `Dockerfile` is a multi-stage build (install deps → compile TS → slim runtime image
on `node:20-slim`). `docker-entrypoint.sh` builds `DATABASE_URL` from the `PG*` env vars and runs
`node-pg-migrate up` automatically before starting the server, so no separate migration step is
needed in `docker-compose.yml` (this mirrors the Flyway auto-migrate-on-boot behavior used by the
Spring Boot services in this platform).

```bash
docker build -t appointment-service .
docker run --rm -p 8083:8083 \
  -e PGHOST=postgres -e PGPORT=5432 -e PGDATABASE=hms_appointment \
  -e PGUSER=appointment_service -e PGPASSWORD=appointment_service_pw \
  -e DOCTOR_SERVICE_URL=http://doctor-service:8082 \
  -e USER_SERVICE_URL=http://user-service:8081 \
  -e KAFKA_BOOTSTRAP=kafka:9092 \
  appointment-service
```

The HTTP server starts and serves sync traffic (availability, booking, reads) immediately; the
Kafka producer (outbox publisher) and the `consultation.completed` consumer connect in the
background with retry, so a slow-starting Kafka broker does not block booking traffic that only
depends on Postgres and the two sync REST calls.

## Tests

```bash
npm test          # vitest run — unit tests + Supertest API tests, all with mocked pg/clients
npm run test:watch
```

Covers:
- Datetime utilities (Asia/Kolkata "today", day-of-week, token/reporting-time arithmetic)
- Availability computation (`AVAILABLE` / `FULLY_BOOKED` / `NOT_AVAILABLE` / `CLOSED`)
- Booking business rules APT-R1..APT-R11, including the APT-R10 worked example from the spec
  (10:00–13:00, limit 50, token 17 → 10:48) and the `23505` unique-violation safety-net mapping
- The sync HTTP client's timeout/5xx/404 → `SERVICE_UNAVAILABLE` / `DOC_NOT_FOUND` mapping
- The outbox publisher's batch-send, stop-on-first-failure, and `running`-flag guard (OB-R1..R3)
- The `consultation.completed` handler's idempotency
- API-level routing, role checks, validation, and the standard success/error envelope, including a
  regression test for Express route ordering on `/internal/appointments/{exists,future-counts,:id}`

Real-Postgres manual verification (row-lock concurrency, date/BIGINT type handling, full endpoint
surface) was additionally performed against a throwaway `postgres:16` container during
development; this is not part of the automated suite but informed two fixes (BIGINT returned as a
JS number instead of a string, and DATE columns kept as raw `YYYY-MM-DD` strings instead of being
reinterpreted through `Date`/`toISOString()`, which previously shifted dates by one day under
`Asia/Kolkata`).

Testcontainers-based integration tests (spinning up real Postgres per test run to exercise the
`SELECT ... FOR UPDATE` row lock under genuine concurrent connections) were intentionally left out
to keep the suite fast and dependency-free in CI; the manual verification above exercised the same
path with 10 concurrent requests against a real Postgres instance and confirmed exactly
`dailyLimit` bookings succeed.

## Key implementation notes / deviations

- **BIGINT/DATE type parsing**: `src/db/pool.ts` registers custom `pg` type parsers so BIGINT
  columns come back as JS numbers (matching the spec's numeric JSON examples) and DATE columns
  come back as raw `YYYY-MM-DD` strings (avoiding a day-shift bug when the host timezone is ahead
  of UTC, e.g. `Asia/Kolkata`). This is an implementation detail of the `pg` driver, not a spec
  deviation.
- **Kafka bootstrap resilience**: the spec doesn't say what happens if Kafka is briefly
  unavailable at startup. `server.ts` starts the HTTP listener immediately and connects the Kafka
  producer/consumer in a background retry loop, so sync-only traffic (availability, booking,
  reads) is never blocked by Kafka startup ordering. Outbox events still queue correctly in
  Postgres and get published once the producer connects.
- **Internal route ordering**: `/internal/appointments/exists` and
  `/internal/appointments/future-counts` are registered before the `/internal/appointments/:id`
  wildcard route, since Express matches routes in registration order and would otherwise treat
  `"exists"`/`"future-counts"` as an `:id` value.
- Everything else follows the spec's step-by-step booking transaction (§5.2), error codes, and
  JSON field names exactly.
