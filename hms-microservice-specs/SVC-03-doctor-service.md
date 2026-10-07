# HMS Microservices — SVC-03 doctor-service

Version: 2.0
Stack: A — Spring Boot 3 (Java 21), MyBatis, Flyway · Port: 8082 · Database: MySQL `hms_doctor`

## 1. Purpose

Owns departments, doctor profiles, consultation details (fee, daily appointment limit) and weekly consultation timings. Admin maintains them; patients read them to choose a doctor.

## 2. Tables

```sql
CREATE TABLE departments (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  dept_name   VARCHAR(100) NOT NULL UNIQUE,     -- Cardiology
  description VARCHAR(300) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_by  BIGINT       NULL,                -- admin user id (X-User-Id), no FK
  updated_by  BIGINT       NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctors (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  department_id        BIGINT        NOT NULL,
  full_name            VARCHAR(100)  NOT NULL,
  qualification        VARCHAR(150)  NOT NULL,         -- MBBS, MD (Cardiology)
  specialization       VARCHAR(100)  NOT NULL,         -- Cardiologist
  registration_number  VARCHAR(50)   NOT NULL UNIQUE,  -- medical council registration no.
  experience_years     INT           NOT NULL DEFAULT 0,
  phone                VARCHAR(15)   NOT NULL,         -- used to verify doctor registration
  email                VARCHAR(100)  NULL,
  about                VARCHAR(1000) NULL,             -- short profile shown to patients
  consultation_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,   -- display only
  daily_limit          INT           NOT NULL DEFAULT 50,  -- max appointments per day
  login_registered     TINYINT(1)    NOT NULL DEFAULT 0,   -- set by event from user-service
  is_active            TINYINT(1)    NOT NULL DEFAULT 1,
  created_by           BIGINT        NULL,
  updated_by           BIGINT        NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_dept   FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT chk_doc_limit CHECK (daily_limit BETWEEN 1 AND 200),
  CONSTRAINT chk_doc_fee   CHECK (consultation_fee >= 0),
  CONSTRAINT chk_doc_exp   CHECK (experience_years BETWEEN 0 AND 70),
  INDEX idx_doc_dept (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctor_availability (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id    BIGINT     NOT NULL,
  day_of_week  TINYINT    NOT NULL,      -- 1 = Monday ... 7 = Sunday
  start_time   TIME       NOT NULL,
  end_time     TIME       NOT NULL,
  created_by   BIGINT     NULL,
  created_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_da_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  CONSTRAINT chk_da_day  CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_da_time CHECK (end_time > start_time),
  UNIQUE KEY uq_da_doctor_day (doctor_id, day_of_week)   -- one window per day
) ENGINE=InnoDB;
```

Plus `outbox_events` (SVC-00 §8.3).

## 3. Business Rules

### 3.1 Departments

| ID | Rule |
|----|------|
| DEP-R1 | `deptName` required, max 100, unique ignoring case → `ADM_DEPARTMENT_EXISTS`. |
| DEP-R2 | Deactivating a department with active doctors → `ADM_DEPARTMENT_HAS_DOCTORS`. |
| DEP-R3 | Departments are never deleted, only deactivated. |

### 3.2 Doctor profile and consultation details

| ID | Rule |
|----|------|
| DOC-R1 | Required: departmentId, fullName, qualification, specialization, registrationNumber, phone, consultationFee → 400 `VALIDATION_FAILED`. |
| DOC-R2 | Department must exist and be active → `ADM_DEPARTMENT_INACTIVE`. |
| DOC-R3 | `registration_number` unique → `ADM_DOCTOR_REG_EXISTS`. |
| DOC-R4 | Fee ≥ 0; experience 0–70; phone 10 digits starting 6–9 → `ADM_DOCTOR_INVALID`. |
| DOC-R5 | `daily_limit` 1–200; default 50 when not sent. |
| DOC-R6 | Reducing `daily_limit`: call appointment-service future-counts. If any date has `count > newLimit` → `ADM_LIMIT_BELOW_BOOKED` (response `data.affected` lists dates and counts). |
| DOC-R7 | Changing department is allowed; existing appointments keep their snapshot department name. |
| DOC-R8 | If `login_registered = 1`, `registration_number` cannot change → `ADM_DOCTOR_REG_LOCKED`. Changing `phone` does not change the doctor's login phone. |
| DOC-R9 | Create doctor and its timings in one transaction. A doctor with no timings shows every date as NOT_AVAILABLE. |

### 3.3 Weekly timings

The admin always sends the full week (replace, not patch).

| ID | Rule |
|----|------|
| AVL-R1 | At most one entry per day; `dayOfWeek` 1–7 → `ADM_DUPLICATE_DAY`. |
| AVL-R2 | `endTime` after `startTime` → `ADM_INVALID_TIME`. |
| AVL-R3 | Window length in minutes ≥ `daily_limit` (each token gets ≥ 1 minute) → `ADM_WINDOW_TOO_SHORT`. |
| AVL-R4 | For each day that is **removed**: call future-counts; if any future date on that weekday has `count > 0` → `ADM_DAY_HAS_BOOKINGS`. |
| AVL-R5 | For each day whose **startTime changes**: same check → `ADM_DAY_HAS_BOOKINGS` (issued reporting times would be wrong). Only extending `endTime` is allowed freely. |
| AVL-R6 | Save in one transaction: delete the doctor's `doctor_availability` rows, insert the new ones. |

### 3.4 Activate / deactivate

| ID | Rule |
|----|------|
| DOC-R10 | Deactivate: call future-counts; any date with `count > 0` → `ADM_DOCTOR_HAS_BOOKINGS`. |
| DOC-R11 | Status change and outbox `doctor.status-changed` in one transaction. |
| DOC-R12 | Inactive doctors are hidden from patient lists, and `weekly-schedule` returns `active: false` so they cannot be booked. |
| DOC-R13 | Doctors are never deleted. |

### 3.5 Calls to appointment-service

DOC-R6, AVL-R4, AVL-R5 and DOC-R10 call `GET /internal/appointments/future-counts?doctorId=`. One call per save is enough (it returns all future dates). If appointment-service is unavailable → 503 `SERVICE_UNAVAILABLE` and nothing is saved.

### 3.6 Patient-facing reads

| ID | Rule |
|----|------|
| DOC-R14 | Only active departments are listed. |
| DOC-R15 | Only active doctors of active departments are listed. |
| DOC-R16 | Patients never see `registration_number`, `phone`, `email`, `login_registered`. |

## 4. Public APIs (through gateway)

### 4.1 Patient (role PATIENT)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/departments | Active departments |
| GET | /api/v1/departments/{id}/doctors | Active doctors in the department with weekly timings |

```json
GET /api/v1/departments/2/doctors
{
  "success": true,
  "data": [
    { "id": 3, "fullName": "Dr. Rahul Menon", "qualification": "MBBS, MD (Cardiology)", "specialization": "Cardiologist",
      "experienceYears": 12, "consultationFee": 500.00, "about": "Interventional cardiologist with 12 years of experience.",
      "timings": [ { "day": "MONDAY", "startTime": "10:00", "endTime": "13:00" },
                   { "day": "WEDNESDAY", "startTime": "14:00", "endTime": "17:00" } ] }
  ]
}
```

Unknown or inactive department → 404 `DOC_DEPARTMENT_NOT_FOUND`.

### 4.2 Admin (role ADMIN)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/admin/departments | All departments with active doctor count |
| POST | /api/v1/admin/departments | Create |
| PUT | /api/v1/admin/departments/{id} | Update name / description |
| PATCH | /api/v1/admin/departments/{id}/status | `{ "active": false }` |
| GET | /api/v1/admin/doctors | Filters `departmentId`, `name`, `active`; paged (`page`, `size`) |
| GET | /api/v1/admin/doctors/{id} | Full profile + timings + `loginRegistered` |
| POST | /api/v1/admin/doctors | Create profile + timings |
| PUT | /api/v1/admin/doctors/{id} | Update profile, fee, daily limit |
| PUT | /api/v1/admin/doctors/{id}/timings | Replace weekly timings |
| PATCH | /api/v1/admin/doctors/{id}/status | `{ "active": false }` |

```json
POST /api/v1/admin/doctors
{
  "departmentId": 2,
  "fullName": "Dr. Rahul Menon",
  "qualification": "MBBS, MD (Cardiology)",
  "specialization": "Cardiologist",
  "registrationNumber": "KMC-45821",
  "experienceYears": 12,
  "phone": "9876543210",
  "email": "rahul@hospital.in",
  "about": "Interventional cardiologist with 12 years of experience.",
  "consultationFee": 500.00,
  "dailyLimit": 50,
  "timings": [
    { "dayOfWeek": 1, "startTime": "10:00", "endTime": "13:00" },
    { "dayOfWeek": 3, "startTime": "14:00", "endTime": "17:00" },
    { "dayOfWeek": 5, "startTime": "10:00", "endTime": "13:00" }
  ]
}
```

Response `201`, message "Doctor added successfully".

Blocked example `409`:
```json
{ "success": false, "errorCode": "ADM_DAY_HAS_BOOKINGS", "message": "Friday cannot be removed: there are future bookings.",
  "data": { "affected": [ { "date": "2026-10-02", "booked": 14 } ] } }
```

`GET /api/v1/admin/appointments` (bookings view) is in appointment-service.

## 5. Internal APIs (provided)

| Method | Path | Used by | Response |
|--------|------|---------|----------|
| GET | /internal/doctors/verify-registration?registrationNumber=&phone= | user-service | 200 `{ doctorId, fullName }`; 404 not found; 409 `{ "reason": "PHONE_MISMATCH" }` or `{ "reason": "INACTIVE" }` |
| GET | /internal/doctors/{id}/weekly-schedule | appointment-service | 200 below; 404 not found |

```json
{ "doctorId": 3, "fullName": "Dr. Rahul Menon", "departmentName": "Cardiology", "active": true, "dailyLimit": 50,
  "timings": [ { "dayOfWeek": 1, "startTime": "10:00", "endTime": "13:00" } ] }
```

`active` is `false` if the doctor or the department is inactive.

## 6. Calls Made

| Call | When |
|------|------|
| appointment-service `GET /internal/appointments/future-counts?doctorId=` | DOC-R6, AVL-R4, AVL-R5, DOC-R10 |

## 7. Events

| Direction | Topic | Payload / action |
|-----------|-------|------------------|
| Publishes (outbox) | `doctor.status-changed` | `{ doctorId, active }` — in the status-change transaction |
| Consumes | `user.doctor-account-registered` | Payload `{ userId, doctorId }`. `UPDATE doctors SET login_registered = 1 WHERE id = ?`. Safe to run twice. |

## 8. Error Codes

`VALIDATION_FAILED`, `DOC_DEPARTMENT_NOT_FOUND`, `DOC_NOT_FOUND`, `ADM_DEPARTMENT_EXISTS`, `ADM_DEPARTMENT_HAS_DOCTORS`, `ADM_DEPARTMENT_INACTIVE`, `ADM_DOCTOR_REG_EXISTS`, `ADM_DOCTOR_REG_LOCKED`, `ADM_DOCTOR_INVALID`, `ADM_LIMIT_BELOW_BOOKED`, `ADM_DUPLICATE_DAY`, `ADM_INVALID_TIME`, `ADM_WINDOW_TOO_SHORT`, `ADM_DAY_HAS_BOOKINGS`, `ADM_DOCTOR_HAS_BOOKINGS`, `SERVICE_UNAVAILABLE`
