# consultation-service

Stack C component of the HMS microservices platform (SVC-05). Python 3.12 /
FastAPI / MongoDB. Owns everything that happens after the patient reaches the
doctor: consultation records, prescriptions, and pharmacy dispensing.

See `hms-microservice-specs/SVC-05-consultation-service.md` for the full
functional spec and `hms-microservice-specs/SVC-00-platform-and-conventions.md`
for platform-wide conventions (API envelope, outbox pattern, headers).

## Project layout

```
app/
  main.py                FastAPI app, lifespan (indexes + outbox publisher), exception handlers
  core/
    config.py             Settings from env vars
    errors.py             BusinessError and subclasses
    envelope.py           success_response / error_response (SVC-00 §7 envelope)
    headers.py            X-User-* header parsing/guards (SVC-00 §6)
    time.py               Asia/Kolkata "today", day-boundary helpers
  db/
    mongo.py              Motor client/database accessors
    indexes.py             Index creation (SVC-05 §2.1/§2.2), run at startup
  schemas/
    consultation.py       Pydantic v2 request/response models, dosage regex
  clients/
    base.py                Shared httpx.AsyncClient wrapper (2s connect/5s total timeout, 5xx/timeout -> SERVICE_UNAVAILABLE)
    appointment_client.py  GET /internal/appointments/{id}, /internal/appointments/exists
    user_client.py         GET /internal/patients/{id}
  repositories/
    consultation_repository.py   All Mongo reads/writes for the consultations collection
    outbox_repository.py
  services/
    validation.py          Pure business-rule validation (vitals, dosage, followup, diagnosis)
    doctor_service.py       Open/save/complete/patient-history (DRC-R1..R18)
    pharmacy_service.py     Pending/search/detail/dispense (PHR-R1..R7)
    patient_service.py      Patient-facing consultation view (PAT-R1..R2)
  events/
    outbox.py               Build + insert outbox_events documents
    publisher.py             asyncio background task, polls every 2s (OB-R1..R3)
  routers/
    doctor_router.py, pharmacy_router.py, patient_router.py
tests/
  test_validation.py        Vitals ranges, dosage regex, item limits, follow-up date
  test_doctor_service.py    Save/complete flows with repo+clients mocked
  test_pharmacy_service.py  Pending/detail/dispense with repo mocked
  test_patient_service.py   Patient view + dispense-message formatting
```

## Configuration (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8084` | HTTP port uvicorn binds to |
| `MONGO_URL` | `mongodb://localhost:27017/hms_consultation?replicaSet=rs0` | Mongo connection string; must point at a **replica set** (multi-document transactions are required for complete + outbox) |
| `APPOINTMENT_SERVICE_URL` | `http://appointment-service:8083` | Base URL for appointment-service internal calls |
| `USER_SERVICE_URL` | `http://user-service:8081` | Base URL for user-service internal calls |
| `KAFKA_BOOTSTRAP` | `kafka:9092` | Kafka bootstrap servers for the outbox publisher |

These match the env vars already wired into the repo's `docker-compose.yml`.

## Running locally

Requires Python 3.12. This sandbox had no system `pip`; see "How this was
verified" below for how a working environment was bootstrapped without root.

```bash
# from consultation-service/
python3 -m venv .venv            # or: python3 -m venv --without-pip .venv && .venv/bin/python get-pip.py
.venv/bin/pip install -r requirements.txt
MONGO_URL="mongodb://localhost:27017/hms_consultation?replicaSet=rs0" \
APPOINTMENT_SERVICE_URL="http://localhost:8083" \
USER_SERVICE_URL="http://localhost:8081" \
KAFKA_BOOTSTRAP="localhost:9092" \
PORT=8084 \
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8084
```

MongoDB must be running as a replica set (even a single-node one — see
`docker/mongo-init.js` in the repo root, run by the `mongo` container defined
in `docker-compose.yml`).

### Docker

```bash
docker build -t consultation-service .
docker run -p 8084:8084 \
  -e MONGO_URL=... -e APPOINTMENT_SERVICE_URL=... -e USER_SERVICE_URL=... -e KAFKA_BOOTSTRAP=... \
  consultation-service
```

In the full stack, this is already wired up as the `consultation-service`
entry in the root `docker-compose.yml`.

## Running tests

```bash
.venv/bin/pip install -r requirements.txt   # includes pytest, pytest-asyncio
.venv/bin/python -m pytest -q
```

82 unit tests, all passing. They cover the service layer only (business
rules, status/ownership gating, error codes) with `ConsultationRepository`,
`AppointmentClient`, `UserClient` and the Motor client replaced by
`unittest.mock.AsyncMock`/`MagicMock` — no real MongoDB, HTTP, or Kafka
connection is needed to run them.

Testcontainers-based Mongo integration tests (real replica-set transactions)
were not included in the test suite to keep `pytest -q` fast and
dependency-free; instead, the full stack (including real multi-document
transactions, the outbox publisher, and a real Kafka broker) was verified
manually end-to-end — see below.

## How this was verified

This sandbox has Python 3.12 but ships with **no pip/ensurepip** and no
`python3-venv`, and has no root/sudo access. Verification path actually used:

1. Downloaded `get-pip.py` from `bootstrap.pypa.io` and ran
   `python3 -m venv --without-pip` to get a bare venv, then
   `venv/bin/python get-pip.py` to install pip *inside* the venv (avoids
   touching the system Python / `externally-managed-environment` guard).
2. `pip install -r requirements.txt` into that venv — succeeded fully.
3. `python -m py_compile` on every `.py` file in the project — all compile.
4. `pytest -q` — all 82 unit tests pass (service layer, mocked
   repositories/clients; see "Running tests" above).
5. **Full live integration smoke test**, using local Docker (available in
   this sandbox): started a single-node Mongo 7 replica set and a real
   KRaft-mode Kafka broker in a Docker network, built the service's actual
   `Dockerfile`, and ran the container against them together with a small
   throwaway FastAPI stub standing in for appointment-service/user-service.
   Exercised, over real HTTP, in order:
   - `GET /health`
   - Doctor open (`GET /doctor/consultations/{id}`) with no document yet —
     fetched the appointment + patient from the stub, returned empty history.
   - Doctor save (`PUT /doctor/consultations/{id}`) — wrong-doctor 403, then
     a correct save that inserted the document with snapshots.
   - Doctor complete (`POST /doctor/consultations/{id}/complete`) — verified
     the Mongo multi-document transaction actually committed (`consultations`
     flipped to `COMPLETED` + `outbox_events` row inserted atomically),
     confirmed re-completing returns `DRC_ALREADY_COMPLETED`.
   - The outbox publisher background task picked up the new row within 2s,
     published it to the real Kafka topic `consultation.completed`, and
     flipped its status to `SENT`; consumed the message directly with
     `kafka-console-consumer` and confirmed the envelope
     (`eventId`/`eventType`/`occurredAt`/`payload`) and message key (`"45"`,
     the `appointmentId`) match SVC-00 §8.1 / SVC-05 §9 exactly.
   - Pharmacy pending list, detail (confirmed `vitals` and `doctorNotes` are
     absent from the JSON), dispense (success, then a second call correctly
     returned `PHR_ALREADY_DISPENSED`), and search by `patientCode`.
   - Doctor patient-history endpoint, including the `DRC_PATIENT_NOT_FOUND`
     path for a doctor who never saw that patient.
   - Patient view of a completed consultation, confirming `doctorNotes` is
     absent and the dispense message is formatted as
     `"Medicines given on {date} ({remarks})"`.

   This live run caught and fixed one real bug: `app/core/envelope.py`
   originally passed raw dicts (containing Python `datetime` values pulled
   straight out of MongoDB documents) directly to `JSONResponse`, which
   doesn't know how to serialize `datetime`. Fixed by routing all response
   bodies through `fastapi.encoders.jsonable_encoder` (with an explicit
   `ObjectId -> str` encoder) before handing them to `JSONResponse`. All
   endpoints were re-verified after the fix. All test containers/images/
   networks created for this were removed afterwards; nothing besides this
   `consultation-service/` directory was touched.

## Deviations from spec / notes

- **DRC-R11 ("complete runs the save rules first")**: implemented so that
  `complete` re-validates and re-persists the body (same as a save) before
  applying the COMPLETED transition, rather than requiring the caller to
  `PUT` first and then `POST /complete` with no body. The spec's example
  (§7.1) shows `POST .../complete` with a full body, which matches this.
- **Vitals/duration bounds are enforced twice**: once by Pydantic
  (`Field(ge=..., le=...)` on `durationDays`, type-level checks) and again
  by the plain if-checks in `app/services/validation.py` per SVC-00 §5
  ("business rules are plain if-checks in the service layer"). The
  service-layer checks are the ones that produce the spec's exact
  `errorCode`s (`DRC_VITALS_INVALID`, `DRC_DOSAGE_INVALID`, etc.); Pydantic
  validation errors are caught by a `RequestValidationError` handler and
  surfaced as `VALIDATION_FAILED` with `fieldErrors` instead, which only
  fires for structurally malformed input (wrong type, missing required
  field) rather than in-range-but-business-invalid input.
- **Outbox `occurredAt`**: taken from the outbox record's `createdAt`
  (set at insert time, inside the same transaction as the business change),
  not from publish time, so it reflects when the event actually happened.
- No separate `app/db` wrapper class was introduced for transactions —
  `DoctorService` is given the raw Motor `AsyncIOMotorClient` directly
  (for `start_session()`/`start_transaction()`), while repositories only
  see the `AsyncIOMotorDatabase` handle, per the folder layout in SVC-05 §2A.
