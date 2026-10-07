# hospital-management-platform_microservice

Polyglot microservice hospital appointment system (one portal, four roles: Patient, Admin,
Doctor, Pharmacist). Full design in [`hms-microservice-specs/`](hms-microservice-specs/),
feature summary in [`FEATURES.md`](FEATURES.md).

## Services

| Spec | Component | Stack | Port | Database |
|------|-----------|-------|------|----------|
| SVC-01 | [api-gateway](api-gateway/) | Spring Cloud Gateway | 8080 | — |
| SVC-02 | [user-service](user-service/) | Spring Boot | 8081 | MySQL `hms_user` |
| SVC-03 | [doctor-service](doctor-service/) | Spring Boot | 8082 | MySQL `hms_doctor` |
| SVC-04 | [appointment-service](appointment-service/) | Node.js/Express | 8083 | PostgreSQL `hms_appointment` |
| SVC-05 | [consultation-service](consultation-service/) | Python/FastAPI | 8084 | MongoDB `hms_consultation` |
| SVC-06 | [notification-service](notification-service/) | Node.js/Express | 8085 | PostgreSQL `hms_notification` |
| SVC-07A | [admin-web](admin-web/) | React + Vite | 5173 | — |
| SVC-07B | [patient-app](patient-app/) | Flutter | 8090 (web build) | — |
| SVC-07C | [clinic-web](clinic-web/) | Next.js | 3000 | — |

## Running everything

```bash
docker compose up --build
```

This starts MySQL, PostgreSQL (host port **5433** — 5432 is commonly taken by a local
Postgres install), MongoDB (as a single-node replica set), Kafka, all six backend services
behind `api-gateway` on `http://localhost:8080`, and all three frontends as static/SSR
bundles:

| App | URL |
|-----|-----|
| admin-web | http://localhost:5173 |
| clinic-web | http://localhost:3000 |
| patient-app (web build) | http://localhost:8090 |

Only the gateway port, the frontend ports, and the databases/Kafka are published to the
host; business services are reached through the gateway only (see `MS-R5` in SVC-00). The
frontends are built with the gateway's host URL baked in at build time, since the browser
calls the gateway directly rather than through the Docker network.

Two one-shot containers (`mongo-rs-init`, `kafka-topics-init`) run once at startup to
initiate the Mongo replica set and pre-create Kafka topics, then exit — seeing them as
"Exited (0)" in `docker compose ps` is expected.

## Running frontends outside Docker

For faster iteration (hot reload), each frontend can still be run with its own tooling
instead of its container — it talks only to the gateway either way:

```bash
cd admin-web   && npm install && npm run dev      # http://localhost:5173
cd clinic-web  && npm install && npm run dev      # http://localhost:3000
cd patient-app && flutter run                     # or: flutter run -d chrome (port 8090)
```

## Conventions

All services follow the shared rules in
[`hms-microservice-specs/SVC-00-platform-and-conventions.md`](hms-microservice-specs/SVC-00-platform-and-conventions.md):
per-service databases, the transactional outbox pattern for Kafka, a common API envelope,
gateway-trusted `X-User-*` headers, and `Asia/Kolkata` as the hospital time zone.