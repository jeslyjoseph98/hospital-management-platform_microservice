# HMS Microservices — SVC-02 user-service

Version: 2.0
Stack: A — Spring Boot 3 (Java 21), MyBatis, Flyway · Port: 8081 · Database: MySQL `hms_user`

## 1. Purpose

Owns login accounts for every role, patient profile details, registration, login and JWT creation.

## 2. Tables

```sql
CREATE TABLE users (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  phone          VARCHAR(15)  NOT NULL UNIQUE,      -- login id
  email          VARCHAR(100) NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,             -- BCrypt
  role           VARCHAR(20)  NOT NULL,
  doctor_id      BIGINT       NULL UNIQUE,          -- only for DOCTOR; id in doctor-service (no FK)
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_role CHECK (role IN ('PATIENT','ADMIN','DOCTOR','PHARMACIST'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patients (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT       NOT NULL UNIQUE,
  patient_code   VARCHAR(20)  NULL UNIQUE,          -- PAT000123, set right after insert
  date_of_birth  DATE         NOT NULL,
  gender         VARCHAR(10)  NOT NULL,
  address        VARCHAR(250) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pat_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_pat_gender CHECK (gender IN ('MALE','FEMALE','OTHER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Plus `outbox_events` (SVC-00 §8.3).

Only PATIENT users have a `patients` row. `users.doctor_id` UNIQUE guarantees one login per doctor.

## 3. Configuration

| Key | Example | Used by |
|-----|---------|---------|
| `hms.admin-registration-code` | `HMS-ADMIN-2026` | REG-R8 |
| `hms.pharmacy-registration-code` | `HMS-PHARM-2026` | REG-R9 |
| `hms.jwt.secret` | from env `HMS_JWT_SECRET` | LOG-R6 |
| `hms.jwt.expiry-minutes` | `60` | LOG-R6 |
| `hms.services.doctor-url` | `http://doctor-service:8082` | REG-R11 |

## 4. Registration

### 4.1 Fields per role

| Field | Patient | Doctor | Pharmacist | Admin |
|-------|---------|--------|------------|-------|
| role | required | required | required | required |
| fullName | required | required | required | required |
| phone | required | required (must match phone admin entered) | required | required |
| email | optional | optional | optional | optional |
| password | required | required | required | required |
| dateOfBirth | required | — | — | — |
| gender | required | — | — | — |
| address | optional | — | — | — |
| registrationNumber | — | required | — | — |
| staffCode | — | — | required | — |
| adminCode | — | — | — | required |

Fields not listed for the chosen role are ignored if sent.

### 4.2 Rules

| ID | Rule |
|----|------|
| REG-R1 | `role` must be PATIENT, DOCTOR, PHARMACIST or ADMIN → `REG_INVALID_ROLE`. |
| REG-R2 | fullName, phone, password required → 400 `VALIDATION_FAILED` with `fieldErrors`. |
| REG-R3 | Phone: 10 digits, first digit 6–9 → `REG_PHONE_INVALID`. |
| REG-R4 | Phone already used by any user → `REG_PHONE_EXISTS`. |
| REG-R5 | Email given and already used → `REG_EMAIL_EXISTS`. |
| REG-R6 | Password: min 8 characters, at least one letter and one digit → `REG_WEAK_PASSWORD`. |
| REG-R7 | PATIENT: dateOfBirth and gender required; gender MALE/FEMALE/OTHER; date of birth not in the future → `REG_DOB_INVALID`. |
| REG-R8 | ADMIN: `adminCode` must equal `hms.admin-registration-code` → `REG_ADMIN_CODE_INVALID`. |
| REG-R9 | PHARMACIST: `staffCode` must equal `hms.pharmacy-registration-code` → `REG_STAFF_CODE_INVALID`. |
| REG-R10 | DOCTOR: `registrationNumber` required. |
| REG-R11 | DOCTOR: call doctor-service `GET /internal/doctors/verify-registration?registrationNumber=&phone=`. 404 → `REG_DOCTOR_NOT_FOUND` ("Ask the admin to add your profile first"). 409 `PHONE_MISMATCH` → `REG_DOCTOR_PHONE_MISMATCH`. 409 `INACTIVE` → `REG_DOCTOR_NOT_FOUND`. Down/timeout → 503 `SERVICE_UNAVAILABLE`. |
| REG-R12 | DOCTOR: if a user with the returned `doctorId` already exists → `REG_DOCTOR_ALREADY_REGISTERED`. |
| REG-R13 | Save in one transaction: insert `users` (`doctor_id` for DOCTOR). PATIENT: insert `patients`, then `patient_code = CONCAT('PAT', LPAD(id, 6, '0'))`. DOCTOR: insert outbox `user.doctor-account-registered`. |
| REG-R14 | If the insert fails on the phone, email or `doctor_id` unique key (two requests at the same moment) → `REG_PHONE_EXISTS` / `REG_EMAIL_EXISTS` / `REG_DOCTOR_ALREADY_REGISTERED`. |

The registration codes stop anyone on the internet from signing up as admin or pharmacy staff. They are one config value and one if-check each.

## 5. Login

### 5.1 Rules

| ID | Rule |
|----|------|
| LOG-R1 | `role`, `phone`, `password` required. `role` must be one of the four → `REG_INVALID_ROLE`. |
| LOG-R2 | Phone not found, or password does not match the BCrypt hash → `AUTH_INVALID_CREDENTIALS` (same message for both). |
| LOG-R3 | Only after the password matches: selected `role` ≠ `users.role` → `AUTH_ROLE_MISMATCH` ("This account is not registered as Doctor"). Checking after the password stops strangers from learning which phones are registered. |
| LOG-R4 | `is_active = 0` → `AUTH_ACCOUNT_INACTIVE`. For doctors this flag follows the doctor's active status through the `doctor.status-changed` event; login never calls doctor-service. |
| LOG-R5 | Success: set `last_login_at = NOW()`. |
| LOG-R6 | JWT HS256, expiry `hms.jwt.expiry-minutes`. Claims: `sub` = user id, `role`, `name`; `patientId` and `patientCode` if PATIENT; `doctorId` if DOCTOR. |

## 6. Public APIs (through gateway)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register | public | Register (section 4) |
| POST | /api/v1/auth/login | public | Login (section 5) |
| GET | /api/v1/auth/me | any logged-in | Current user (validates the token itself, see below) |
| GET | /api/v1/patients/me | PATIENT | Own profile |

`/api/v1/auth/me`: because the whole `/auth/**` prefix is public in the gateway, this one endpoint reads the `Authorization` header and validates the JWT itself (same secret). Invalid → 401 `AUTH_TOKEN_INVALID`.

### 6.1 Register examples

```json
POST /api/v1/auth/register
{ "role": "PATIENT", "fullName": "John Mathew", "phone": "9845012345", "email": "john@mail.com",
  "password": "john1234", "dateOfBirth": "1988-04-12", "gender": "MALE", "address": "Kuvempunagar, Mysuru" }
```
```json
POST /api/v1/auth/register
{ "role": "DOCTOR", "fullName": "Dr. Rahul Menon", "phone": "9876543210", "password": "rahul1234", "registrationNumber": "KMC-45821" }
```
```json
POST /api/v1/auth/register
{ "role": "PHARMACIST", "fullName": "Priya S", "phone": "9123456780", "password": "priya1234", "staffCode": "HMS-PHARM-2026" }
```
```json
POST /api/v1/auth/register
{ "role": "ADMIN", "fullName": "Anita Rao", "phone": "9900112233", "password": "anita1234", "adminCode": "HMS-ADMIN-2026" }
```

Response `201`:
```json
{ "success": true, "data": { "userId": 7, "role": "PATIENT", "patientCode": "PAT000123" }, "message": "Registration successful. Please log in." }
```
(`patientCode` is `null` for other roles.)

### 6.2 Login

```json
POST /api/v1/auth/login
{ "role": "PATIENT", "phone": "9845012345", "password": "john1234" }
```
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 3600,
    "user": { "id": 7, "name": "John Mathew", "role": "PATIENT", "patientId": 123, "patientCode": "PAT000123", "doctorId": null }
  }
}
```

`GET /api/v1/auth/me` returns the same `user` object.

### 6.3 Patient profile

```json
GET /api/v1/patients/me
{ "success": true, "data": { "patientId": 123, "patientCode": "PAT000123", "name": "John Mathew", "phone": "9845012345",
  "email": "john@mail.com", "dateOfBirth": "1988-04-12", "age": 38, "gender": "MALE", "address": "Kuvempunagar, Mysuru" } }
```

## 7. Internal APIs (provided)

| Method | Path | Used by | Response |
|--------|------|---------|----------|
| GET | /internal/patients/{patientId} | appointment-service, consultation-service | 200 `{ patientId, patientCode, name, phone, dateOfBirth, gender, address }`; 404 if not found |

## 8. Calls Made

| Call | When |
|------|------|
| doctor-service `GET /internal/doctors/verify-registration` | REG-R11 |

## 9. Events

| Direction | Topic | Payload / action |
|-----------|-------|------------------|
| Publishes (outbox) | `user.doctor-account-registered` | `{ userId, doctorId }` — in the registration transaction |
| Consumes | `doctor.status-changed` | Payload `{ doctorId, active }`. Run `UPDATE users SET is_active = ? WHERE doctor_id = ?`. Safe to run twice. 0 rows (doctor not registered yet) → ignore. |

## 10. Error Codes

`VALIDATION_FAILED`, `REG_INVALID_ROLE`, `REG_PHONE_INVALID`, `REG_PHONE_EXISTS`, `REG_EMAIL_EXISTS`, `REG_WEAK_PASSWORD`, `REG_DOB_INVALID`, `REG_ADMIN_CODE_INVALID`, `REG_STAFF_CODE_INVALID`, `REG_DOCTOR_NOT_FOUND`, `REG_DOCTOR_PHONE_MISMATCH`, `REG_DOCTOR_ALREADY_REGISTERED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_ROLE_MISMATCH`, `AUTH_ACCOUNT_INACTIVE`, `AUTH_TOKEN_INVALID`, `SERVICE_UNAVAILABLE`
