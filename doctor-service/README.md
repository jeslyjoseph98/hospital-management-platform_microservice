# doctor-service (SVC-03)

Spring Boot 3 (Java 17 at build time; spec calls for 21 — Spring Boot 3 fully supports 17, used here because
only JDK 17 is installed on the dev host), MyBatis (XML mappers), Flyway, MySQL 8. Port `8082`, database
`hms_doctor`.

Owns departments, doctor profiles, consultation details (fee, daily appointment limit) and weekly
consultation timings. Admin maintains them; patients read them to choose a doctor.

## Run locally

Prerequisites: JDK 17, Maven 3.9+, a reachable MySQL 8 instance with database `hms_doctor`, and (optionally)
a Kafka broker for the outbox publisher / `user.doctor-account-registered` consumer to do anything useful.

```bash
# compile only
mvn -q -DskipTests compile

# run unit tests
mvn -q test

# package the runnable jar
mvn -q -DskipTests package

# run (uses application.yml defaults unless overridden by env vars below)
java -jar target/doctor-service.jar
```

Flyway migrations run automatically on startup against `SPRING_DATASOURCE_URL`.

## Run with Docker

```bash
docker build -t doctor-service .
docker run -p 8082:8082 \
  -e SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/hms_doctor?useSSL=false&allowPublicKeyRetrieval=true \
  -e SPRING_DATASOURCE_USERNAME=doctor_service \
  -e SPRING_DATASOURCE_PASSWORD=doctor_service_pw \
  -e HMS_SERVICES_APPOINTMENT_URL=http://appointment-service:8083 \
  -e KAFKA_BOOTSTRAP=kafka:9092 \
  doctor-service
```

In the platform's `docker-compose.yml` this service is wired up as `doctor-service` already; no changes
needed there.

## Environment variables read

| Variable | Default | Purpose |
|----------|---------|---------|
| `SERVER_PORT` | `8082` | HTTP port |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/hms_doctor?useSSL=false&allowPublicKeyRetrieval=true` | MySQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `doctor_service` | MySQL username |
| `SPRING_DATASOURCE_PASSWORD` | `doctor_service_pw` | MySQL password |
| `HMS_SERVICES_APPOINTMENT_URL` | `http://localhost:8083` | Base URL of appointment-service (sync calls for future-counts) |
| `KAFKA_BOOTSTRAP` | `localhost:9092` | Kafka bootstrap servers |

## Architecture

- `controller` — REST controllers: patient-facing (`/api/v1/departments`), admin
  (`/api/v1/admin/departments`, `/api/v1/admin/doctors`), and internal (`/internal/doctors/**`).
- `service` — business logic: `DepartmentService`, `DoctorService`, `DoctorAvailabilityService`,
  `DoctorValidationService`, `InternalDoctorService`, `WeeklyTimingsValidator`.
- `mapper` — MyBatis mapper interfaces + `src/main/resources/mapper/*.xml`.
- `client` — `AppointmentServiceClient`: sync call to appointment-service's
  `GET /internal/appointments/future-counts?doctorId=` (connect timeout 2s, read timeout 5s; any
  failure/5xx surfaces as 503 `SERVICE_UNAVAILABLE` and nothing is saved, per MS-R4).
- `event` — transactional outbox (`OutboxService` writes within the business transaction,
  `OutboxPublisher` is a `@Scheduled(fixedDelay = 2000)` job that sends the oldest 50 `NEW` rows and marks
  them `SENT` on ack, stopping the run on first failure so it retries next tick — OB-R1..OB-R3), plus the
  `user.doctor-account-registered` Kafka consumer (`DoctorAccountRegisteredConsumer`, idempotent — it's a
  plain `UPDATE ... SET login_registered = 1 WHERE id = ?`).
- `dto`, `model`, `exception`, `util`, `config` — request/response shapes, MyBatis entity POJOs, the
  `BusinessException` → `GlobalExceptionHandler` mapping to the SVC-00 §7 envelope, header/day-name
  helpers, and Kafka topic declarations.

## Business rules implemented

- **Departments**: unique name (case-insensitive) → `ADM_DEPARTMENT_EXISTS`; deactivation blocked while
  active doctors exist → `ADM_DEPARTMENT_HAS_DOCTORS`; never hard-deleted.
- **Doctor profile**: required-field validation, fee/experience/phone-format checks
  (`ADM_DOCTOR_INVALID`), department-must-be-active check (`ADM_DEPARTMENT_INACTIVE`), unique registration
  number (`ADM_DOCTOR_REG_EXISTS`), daily limit 1–200 default 50, doctor + timings created in one
  transaction.
- **Registration-number lock**: once `login_registered = 1`, changing `registrationNumber` →
  `ADM_DOCTOR_REG_LOCKED`.
- **Safe daily-limit reduction**: lowering `dailyLimit` calls appointment-service future-counts; any future
  date already booked above the new limit blocks the update with `ADM_LIMIT_BELOW_BOOKED` and
  `data.affected = [{ date, booked }]`.
- **Weekly timings (full-week replace)**: duplicate day (`ADM_DUPLICATE_DAY`), end before/equal start
  (`ADM_INVALID_TIME`), window shorter than `dailyLimit` minutes (`ADM_WINDOW_TOO_SHORT`); removing a day or
  moving its start time earlier (or changing it at all) while future bookings exist on that weekday is
  blocked with `ADM_DAY_HAS_BOOKINGS`; extending `endTime` alone is always allowed without calling
  appointment-service; save is delete-then-insert in one transaction.
- **Activate/deactivate**: deactivating with future bookings blocked (`ADM_DOCTOR_HAS_BOOKINGS`); on
  success, status change and the `doctor.status-changed` outbox write happen in the same transaction.
- **Patient-facing reads**: only active departments / active doctors of active departments are listed;
  `registrationNumber`, `phone`, `email`, `loginRegistered` are never present in patient-facing responses.
- **Internal APIs**: `GET /internal/doctors/verify-registration` (used by user-service; returns a bare
  `{ reason: "PHONE_MISMATCH" | "INACTIVE" }` body on 409 and a bare 404, not the standard envelope, per the
  spec's example) and `GET /internal/doctors/{id}/weekly-schedule` (`active` reflects both doctor and
  department status).

## Tests

`src/test/java/com/hms/doctor/service` — JUnit 5 + Mockito unit tests covering:

- `DoctorServiceTest` — registration-number lock, daily-limit reduction gating (blocked/allowed/increase
  skips the call/503 propagation), deactivate-with-bookings block, create validations.
- `DoctorAvailabilityServiceTest` — AVL-R1..R6: duplicate day, invalid time range, window-too-short,
  removed-day-with-bookings block, start-time-change-with-bookings block, free end-time extension, adding a
  new day skips the future-counts call.
- `DepartmentServiceTest` — duplicate name, deactivation-with-doctors block.
- `InternalDoctorServiceTest` — verify-registration (found/not-found/phone-mismatch/inactive) and
  weekly-schedule `active` flag combining doctor + department status.

Run with `mvn -q test` (34 tests, all passing at last run). Testcontainers integration tests were not added
(not a blocker per the task); the MyBatis XML mappers were instead verified via a full `mvn package` plus
manual review against the DDL.

## Deviations from spec (with justification)

- Java 17 instead of 21 for `maven.compiler.release` / the Docker base images, because only JDK 17 is
  available on this build host. Spring Boot 3.3 fully supports Java 17; no language features above 17 were
  used. Swap `java.version`/`maven.compiler.release` to `21` and the Dockerfile base images to
  `maven:3.9-eclipse-temurin-21` / `eclipse-temurin:21-jre` to match the spec exactly once Java 21 is
  available.
- The internal `verify-registration` endpoint intentionally bypasses the standard `ApiResponse` envelope
  (via a scoped `@RestControllerAdvice` on `InternalDoctorController` only) because the spec's example shows
  bare `{ "reason": ... }` / empty-body 404 responses rather than the `{ success, data, ... }` wrapper used
  by public endpoints.
