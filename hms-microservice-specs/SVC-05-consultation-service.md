# HMS Microservices — SVC-05 consultation-service

Version: 2.0
Stack: C — Python 3.12 (FastAPI) · Port: 8084 · Database: MongoDB `hms_consultation`

## 1. Purpose

Owns what happens after the patient reaches the doctor:
- Doctor: open the appointment, see patient details and past visits, record consultation details and vitals, write the prescription, complete the visit.
- Pharmacist: see prescriptions, give medicines, mark as done.
- Patient: view own consultation summary and prescription.

Pharmacy lives here because dispensing is only a small `dispense` sub-document on the consultation.

## 2. Data Model (MongoDB)

### 2.1 Collection `consultations`

One document per appointment. Vitals and prescription items are embedded, so a consultation is read and written as one document.

```json
{
  "_id": "ObjectId",                        // consultationId (string in APIs and events)
  "appointmentId": 45,                      // id in appointment-service
  "patientId": 123,                         // id in user-service
  "doctorId": 3,                            // id in doctor-service

  "appointmentCode": "APT00000045",         // snapshots copied on first save
  "appointmentDate": "2026-09-28",          // stored as string YYYY-MM-DD (date only)
  "tokenNumber": 17,
  "patientName": "John Mathew",
  "patientCode": "PAT000123",
  "patientGender": "MALE",
  "patientDob": "1988-04-12",
  "doctorName": "Dr. Rahul Menon",
  "departmentName": "Cardiology",

  "chiefComplaint": "Fever for 3 days",
  "symptoms": "Fever, headache, body pain",
  "vitals": { "temperatureC": 38.6, "pulseBpm": 96, "bpSystolic": 124, "bpDiastolic": 82, "weightKg": 72.5 },
  "diagnosis": "Viral fever",
  "doctorNotes": "No rashes.",              // private: never returned to patient or pharmacist
  "advice": "Rest and drink plenty of fluids.",
  "followUpDate": "2026-10-03",
  "prescription": [
    { "medicineName": "Paracetamol", "strength": "500mg", "dosagePattern": "1-0-1",
      "timing": "AFTER_FOOD", "durationDays": 5, "instructions": null }
  ],

  "status": "IN_PROGRESS",                  // IN_PROGRESS | COMPLETED
  "completedAt": null,                      // Date (UTC)

  "dispense": {
    "status": "NOT_REQUIRED",               // NOT_REQUIRED | PENDING | DISPENSED
    "byUserId": null, "byName": null, "at": null, "remarks": null
  },

  "createdAt": "Date",
  "updatedAt": "Date"
}
```

Indexes (created at startup):

| Index | Purpose |
|-------|---------|
| `{ appointmentId: 1 }` **unique** | One consultation per appointment; protects against two first-saves at once |
| `{ patientId: 1, completedAt: -1 }` | Patient history |
| `{ "dispense.status": 1, completedAt: 1 }` | Pharmacy pending list |
| `{ patientCode: 1 }`, `{ appointmentCode: 1 }` | Pharmacy search |

Allowed values (status, timing, dispense status) and field lengths are enforced by Pydantic models. Optionally add a MongoDB `$jsonSchema` validator on the collection with the same enums.

### 2.2 Collection `outbox_events`

As SVC-00 §8.3 (MongoDB version). Writing the consultation and the outbox event together uses a **multi-document transaction**, so MongoDB must run as a replica set.

## 2A. Implementation (Stack C — Python)

| Item | Choice |
|------|--------|
| Runtime / framework | Python 3.12, FastAPI, Uvicorn |
| MongoDB | Motor (async); transactions with `async with await client.start_session() as s: async with s.start_transaction():` |
| Validation | Pydantic v2 request/response models |
| Sync calls | `httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0))`; connection error / timeout / 5xx → `SERVICE_UNAVAILABLE` |
| Kafka | aiokafka producer (outbox task) |
| Outbox job | `asyncio` background task started on app startup: loop, run, `await asyncio.sleep(2)` |
| Headers | FastAPI dependencies read `X-User-Id`, `X-User-Role`, `X-User-Name`, `X-Patient-Id`, `X-Doctor-Id` |
| Folders | `app/routers`, `app/services`, `app/repositories`, `app/schemas`, `app/clients`, `app/events`, `app/db/indexes.py` |
| Errors | `class BusinessError(Exception): code, status`; one exception handler writes the standard JSON (SVC-00 §7) |
| Duplicate key | `pymongo.errors.DuplicateKeyError` (code 11000) |
| Date handling | `appointmentDate`, `followUpDate`, `patientDob` stored as `YYYY-MM-DD` strings; "today" uses the hospital time zone `Asia/Kolkata` |

## 3. Status Flows

```
Consultation:   IN_PROGRESS ──► COMPLETED

Dispense (set at completion):
   no prescription items  ──► NOT_REQUIRED
   1+ items               ──► PENDING ──► DISPENSED   (pharmacist)
```

## 4. Doctor — Rules

### 4.1 Opening an appointment

`GET /api/v1/doctor/consultations/{appointmentId}`:

| ID | Rule |
|----|------|
| DRC-R1 | If a consultation document exists for the appointment: it must have `doctorId` = `X-Doctor-Id` → else `DRC_NOT_YOUR_APPOINTMENT`. Use its snapshots. |
| DRC-R2 | If no document exists: call appointment-service `GET /internal/appointments/{id}`. 404 → `DRC_APPOINTMENT_NOT_FOUND`. `doctor_id` ≠ header → `DRC_NOT_YOUR_APPOINTMENT`. |
| DRC-R3 | Call user-service `GET /internal/patients/{patientId}` for phone, address and current age (not snapshotted). |
| DRC-R4 | Response: appointment (code, date, token, status), patient details, last 5 completed visits (section 4.4), and the consultation with prescription items if it exists. |

### 4.2 Save (can be done many times)

`PUT /api/v1/doctor/consultations/{appointmentId}`:

| ID | Rule |
|----|------|
| DRC-R5 | If no consultation document exists: call appointment-service; appointment must belong to the doctor (`DRC_NOT_YOUR_APPOINTMENT`), have `appointmentDate` = today (`DRC_NOT_TODAY`), and `status` = BOOKED (`DRC_ALREADY_COMPLETED`). Insert the document with snapshots, `status = IN_PROGRESS`. If the insert raises `DuplicateKeyError` (another save created it a moment ago) → continue as DRC-R6. |
| DRC-R6 | If a document exists: `doctorId` = header (`DRC_NOT_YOUR_APPOINTMENT`), `appointmentDate` = today (`DRC_NOT_TODAY`), `status` = IN_PROGRESS (`DRC_ALREADY_COMPLETED`). Update with `update_one({ _id, status: "IN_PROGRESS" }, { $set: ... })`; `matched_count == 0` → `DRC_ALREADY_COMPLETED`. No call to appointment-service. |
| DRC-R7 | Vitals, if entered (else `DRC_VITALS_INVALID`): temperature 30–45, pulse 20–250, systolic 50–260, diastolic 30–160, weight 0.5–350. |
| DRC-R8 | `followUpDate`, if entered, must be after today → `DRC_FOLLOWUP_INVALID`. |
| DRC-R9 | Prescription: 0–20 items → `DRC_TOO_MANY_ITEMS`. Each item: `medicineName` required; `durationDays` 1–365; `timing` one of the four; `dosagePattern` matches `^[0-9]-[0-9]-[0-9]$` and is not `0-0-0` unless timing = AS_NEEDED → `DRC_DOSAGE_INVALID`. |
| DRC-R10 | The `prescription` array is replaced on every save with `$set: { prescription: [...] }` (one update, no delete/insert). |

### 4.3 Complete

`POST /api/v1/doctor/consultations/{appointmentId}/complete` (same body as save):

| ID | Rule |
|----|------|
| DRC-R11 | Runs the save rules DRC-R5 to R10 first. |
| DRC-R12 | `diagnosis` required → `DRC_DIAGNOSIS_REQUIRED`. |
| DRC-R13 | One MongoDB transaction: update the consultation (fields, `status = COMPLETED`, `completedAt = now`, `dispense.status = PENDING` if 1+ items else `NOT_REQUIRED`) with filter `status: "IN_PROGRESS"`; insert into `outbox_events` `consultation.completed`. If the update matched 0 → abort, `DRC_ALREADY_COMPLETED`. |
| DRC-R14 | appointment-service (Node) sets the appointment to COMPLETED when it consumes the event, usually within seconds. |
| DRC-R15 | After COMPLETED, consultation and items are read-only → `DRC_ALREADY_COMPLETED`. |

### 4.4 Patient details and history

`GET /api/v1/doctor/patients/{patientId}`:

| ID | Rule |
|----|------|
| DRC-R16 | Call appointment-service `GET /internal/appointments/exists?doctorId=&patientId=`. `false` → `DRC_PATIENT_NOT_FOUND`. A doctor can open only patients who booked with them. |
| DRC-R17 | Call user-service for name, code, age, gender, phone, address. |
| DRC-R18 | History: `find({ patientId, status: "COMPLETED" }).sort({ completedAt: -1 })` — this patient's consultations (any doctor), newest first, each with date, doctor name, department, chief complaint, diagnosis, advice, doctor notes, follow-up date, prescription items, dispense status. |

## 5. Pharmacist — Rules

| ID | Rule |
|----|------|
| PHR-R1 | Pending list: `find({ status: "COMPLETED", "dispense.status": "PENDING", completedAt: { $gte: dayStart, $lt: nextDayStart } })` sorted by `completedAt` ascending. `date` filter defaults to today (day boundaries in `Asia/Kolkata`, converted to UTC). |
| PHR-R2 | Search `q`: `$or` exact match on `patientCode` or `appointmentCode`, `completedAt` in the last 30 days, `dispense.status` in PENDING / DISPENSED. (Phone search is not available: phone is not snapshotted.) |
| PHR-R3 | Detail shows patient name, code, age, gender; doctor, department; consultation date; diagnosis; items; follow-up date; dispense status. Never `doctorNotes` or vitals (use a projection). |
| PHR-R4 | Mark as done: document not found → `PHR_NOT_FOUND`; `dispense.status = NOT_REQUIRED` → `PHR_NOTHING_TO_DISPENSE`. |
| PHR-R5 | Mark as done is one atomic update: `update_one({ _id, "dispense.status": "PENDING" }, { $set: { "dispense.status": "DISPENSED", "dispense.byUserId", "dispense.byName", "dispense.at": now, "dispense.remarks" } })`. `matched_count == 0` → `PHR_ALREADY_DISPENSED`. This stops two pharmacists marking the same prescription. |
| PHR-R6 | `remarks` optional, max 500 (e.g. "Cetirizine not available, advised to buy outside"). |
| PHR-R7 | DISPENSED is final (no undo). |

## 6. Patient — Rules

| ID | Rule |
|----|------|
| PAT-R1 | `GET /api/v1/consultations/my/{appointmentId}`: document must exist, `status = COMPLETED`, and `patientId` = `X-Patient-Id` → else 404 `DRC_NOT_FOUND`. |
| PAT-R2 | Returns date, doctor, department, chief complaint, diagnosis, advice, follow-up date, vitals, prescription items, and dispense info: "Medicines given on {date}" + remarks, or "Medicines not yet collected", or nothing if NOT_REQUIRED. Never `doctorNotes`. |

## 7. Public APIs (through gateway)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/v1/doctor/consultations/{appointmentId} | DOCTOR | §4.1 |
| PUT | /api/v1/doctor/consultations/{appointmentId} | DOCTOR | Save §4.2 |
| POST | /api/v1/doctor/consultations/{appointmentId}/complete | DOCTOR | Complete §4.3 |
| GET | /api/v1/doctor/patients/{patientId} | DOCTOR | §4.4 |
| GET | /api/v1/pharmacy/prescriptions/pending?date= | PHARMACIST | PHR-R1 |
| GET | /api/v1/pharmacy/prescriptions/search?q= | PHARMACIST | PHR-R2 |
| GET | /api/v1/pharmacy/prescriptions/{consultationId} | PHARMACIST | PHR-R3 (`consultationId` = ObjectId string) |
| POST | /api/v1/pharmacy/prescriptions/{consultationId}/dispense | PHARMACIST | PHR-R4–R6 |
| GET | /api/v1/consultations/my/{appointmentId} | PATIENT | §6 |

### 7.1 Save / complete body

```json
POST /api/v1/doctor/consultations/45/complete
{
  "chiefComplaint": "Fever for 3 days",
  "symptoms": "Fever, headache, body pain",
  "temperatureC": 38.6, "pulseBpm": 96, "bpSystolic": 124, "bpDiastolic": 82, "weightKg": 72.5,
  "diagnosis": "Viral fever",
  "doctorNotes": "No rashes. Throat mildly congested.",
  "advice": "Rest and drink plenty of fluids.",
  "followUpDate": "2026-10-03",
  "prescription": [
    { "medicineName": "Paracetamol", "strength": "500mg", "dosagePattern": "1-0-1", "timing": "AFTER_FOOD", "durationDays": 5 },
    { "medicineName": "Cetirizine",  "strength": "10mg",  "dosagePattern": "0-0-1", "timing": "BEDTIME",    "durationDays": 5 }
  ]
}
```

Response message: "Consultation saved" / "Consultation completed".

### 7.2 Pharmacy pending

```json
GET /api/v1/pharmacy/prescriptions/pending
{
  "success": true,
  "data": [
    { "consultationId": "66f7c1a2e4b0a1b2c3d4e5f6", "appointmentCode": "APT00000045", "tokenNumber": 17,
      "patientName": "John Mathew", "patientCode": "PAT000123",
      "doctorName": "Dr. Rahul Menon", "departmentName": "Cardiology",
      "completedAt": "2026-09-28T11:05:00", "itemCount": 2, "dispenseStatus": "PENDING" }
  ]
}
```

### 7.3 Mark as done

```json
POST /api/v1/pharmacy/prescriptions/66f7c1a2e4b0a1b2c3d4e5f6/dispense
{ "remarks": "All medicines given" }
```
Response message "Marked as done", with `dispenseStatus`, `dispensedAt`, `dispensedByName`.

All API responses use camelCase and the standard envelope (SVC-00 §7); `_id` is returned as `consultationId` string.

## 8. Calls Made

| Call | When |
|------|------|
| appointment-service `GET /internal/appointments/{id}` | DRC-R2, DRC-R5 (only when no consultation document yet) |
| appointment-service `GET /internal/appointments/exists` | DRC-R16 |
| user-service `GET /internal/patients/{id}` | DRC-R3, DRC-R17 |

## 9. Events

| Direction | Topic | Payload |
|-----------|-------|---------|
| Publishes (outbox) | `consultation.completed` | `{ consultationId: "66f7…", appointmentId: 45 }` — in the complete transaction; message key = `appointmentId` |

## 10. Error Codes

`VALIDATION_FAILED`, `DRC_APPOINTMENT_NOT_FOUND`, `DRC_NOT_YOUR_APPOINTMENT`, `DRC_NOT_TODAY`, `DRC_ALREADY_COMPLETED`, `DRC_VITALS_INVALID`, `DRC_FOLLOWUP_INVALID`, `DRC_TOO_MANY_ITEMS`, `DRC_DOSAGE_INVALID`, `DRC_DIAGNOSIS_REQUIRED`, `DRC_PATIENT_NOT_FOUND`, `DRC_NOT_FOUND`, `PHR_NOT_FOUND`, `PHR_NOTHING_TO_DISPENSE`, `PHR_ALREADY_DISPENSED`, `SERVICE_UNAVAILABLE`
