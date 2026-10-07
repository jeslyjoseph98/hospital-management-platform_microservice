# user-service

Owns login accounts for every role (PATIENT, ADMIN, DOCTOR, PHARMACIST), patient profile
details, registration, login and JWT creation. Part of the HMS microservices platform
(see `hms-microservice-specs/SVC-02-user-service.md` for the full spec).

Stack: Spring Boot 3 (Java), MyBatis (XML mappers), Flyway, MySQL, Maven · Port: 8081 ·
Database: MySQL `hms_user`.

Built/tested locally against JDK 17 (the platform spec calls for Java 21; Spring Boot 3
fully supports 17, so `java.version` / `maven.compiler.release` are pinned to 17 to match
what's available on this host). The Docker image also uses JDK 17
(`maven:3.9-eclipse-temurin-17` / `eclipse-temurin:17-jre`).

## Running locally

Requires a MySQL 8 instance with a `hms_user` database and a user that can create tables
(Flyway runs migrations on startup), plus a reachable Kafka broker (the outbox publisher
and the `doctor.status-changed` consumer need it, but the app will otherwise start even
if Kafka is briefly unavailable).

```bash
mvn -q spring-boot:run
```

Or build and run the jar:

```bash
mvn -q -DskipTests package
java -jar target/user-service.jar
```

Or via Docker (as wired into the platform's root `docker-compose.yml` by the gateway/infra
agent):

```bash
docker build -t user-service .
docker run -p 8081:8081 --env-file .env user-service
```

## Configuration (environment variables)

All config is overridable via env vars (Spring relaxed binding), matching the names wired
into the platform's `docker-compose.yml`:

| Env var | Default (local) | Purpose |
|---|---|---|
| `SERVER_PORT` | `8081` | HTTP port |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/hms_user?useSSL=false&allowPublicKeyRetrieval=true` | MySQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `root` | MySQL user |
| `SPRING_DATASOURCE_PASSWORD` | `root` | MySQL password |
| `HMS_JWT_SECRET` | dev placeholder | HMAC-SHA256 signing secret for JWTs |
| `HMS_JWT_EXPIRY_MINUTES` | `60` | JWT expiry |
| `HMS_ADMIN_REGISTRATION_CODE` | `HMS-ADMIN-2026` | Gate code required to self-register as ADMIN |
| `HMS_PHARMACY_REGISTRATION_CODE` | `HMS-PHARM-2026` | Gate code required to self-register as PHARMACIST |
| `HMS_SERVICES_DOCTOR_URL` | `http://localhost:8082` | Base URL for doctor-service sync calls |
| `KAFKA_BOOTSTRAP` | `localhost:9092` | Kafka bootstrap servers |

## What's implemented

- **Tables** (Flyway `src/main/resources/db/migration/V1__init.sql`): `users`, `patients`,
  `outbox_events` (exact DDL from SVC-00 §8.3 / SVC-02 §2).
- **Registration** (`POST /api/v1/auth/register`) for all 4 roles — REG-R1..REG-R14:
  role-specific required fields, phone/password format checks, phone/email uniqueness
  (plus a race-safe fallback on unique-constraint violation at insert time), admin/staff
  registration codes, doctor registration verified against doctor-service
  (`GET /internal/doctors/verify-registration`) with the `user.doctor-account-registered`
  outbox event written in the same transaction as the user insert, and patient-code
  generation (`PATxxxxxx`) right after the patient row is inserted.
- **Login** (`POST /api/v1/auth/login`) — LOG-R1..LOG-R6: credential check before role
  check (to avoid phone enumeration), `is_active` enforcement, `last_login_at` update, and
  JWT (HS256) issuance with `sub`/`role`/`name` plus `patientId`/`patientCode` (PATIENT) or
  `doctorId` (DOCTOR) claims.
- **`GET /api/v1/auth/me`** — validates the bearer token itself (the whole `/auth/**`
  prefix is public at the gateway) using the same JWT secret; returns the same `user` shape
  as login.
- **`GET /api/v1/patients/me`** — own patient profile with computed age (computed in the
  `Asia/Kolkata` hospital time zone per SVC-00 §5), driven off the `X-User-Id` header the
  gateway sets.
- **`GET /internal/patients/{patientId}`** — internal lookup used by appointment-service
  and consultation-service.
- **Kafka consumer** for `doctor.status-changed` — idempotent `UPDATE users SET is_active
  WHERE doctor_id = ?`; 0 rows affected (doctor not registered yet) is logged and ignored,
  not an error; safe to process the same message twice.
- **Outbox publisher** (`@Scheduled(fixedDelay = 2000)`) — OB-R1..OB-R3: oldest 50 `NEW`
  rows per run, Kafka ack awaited per message, `SENT` + `sent_at` set on ack, and the run
  stops (remaining rows retried next tick) on the first failure.

## Layout

```
src/main/java/com/hms/userservice/
  controller/   AuthController, PatientController, InternalPatientController
  service/      RegistrationService, AuthService, PatientService
  mapper/       UserMapper, PatientMapper, OutboxEventMapper (+ XML in resources/mapper)
  domain/       User, Patient, OutboxEvent
  dto/          request/response shapes, ApiResponse envelope, FieldError
  client/       DoctorServiceClient (sync call to doctor-service verify-registration)
  event/        OutboxEventWriter, OutboxPublisher, DoctorStatusChangedConsumer, payloads
  security/     JwtService
  config/       HmsProperties, AppConfig (PasswordEncoder, RestClient), SecurityConfig
  exception/    BusinessException, ValidationFailedException, GlobalExceptionHandler
```

## Tests

JUnit 5 + Mockito unit tests covering the REG-R*/LOG-R* business rules, login's
credential-before-role-check ordering, JWT issuance/`/auth/me` round-trip, age computation,
and the `doctor.status-changed` consumer's idempotency/ignore-0-rows behavior:

```bash
mvn -q test
```

No Testcontainers/integration tests are included — given the time budget, the priority was
a thorough unit-test suite over the business rules. The Flyway migration and MyBatis XML
mappers have been manually reviewed against the spec's DDL and are exercised implicitly by
`mvn -q -DskipTests compile` (mapper/XML wiring is validated at application startup by
MyBatis, not at compile time).

## Deviations from spec (with justification)

- **JDK 17 instead of 21**: only JDK 17 is installed on this build host; Spring Boot 3.3.x
  fully supports 17. `pom.xml` pins `java.version=17` / `maven.compiler.release=17` and the
  Dockerfile uses `maven:3.9-eclipse-temurin-17` / `eclipse-temurin:17-jre`. No functional
  impact.
- **JWT secret padding**: `HMS_JWT_SECRET` is HMAC-SHA256 signed, which requires a key of
  at least 256 bits. If a shorter secret is configured (e.g. a short local/dev value),
  `JwtService` deterministically repeats the bytes to 32 bytes rather than failing at
  startup. In any real deployment the configured secret should already be ≥32 bytes.
- **No Testcontainers integration tests**: per the task's priority ordering ("don't let
  [Testcontainers] block a working build"), only Mockito-based service-layer unit tests
  were written. The Flyway DDL and MyBatis mappers match the spec's SQL exactly.
