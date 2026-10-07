# HMS Microservices — SVC-07C clinic-web (Next.js)

Version: 1.0
Stack: C — Next.js 14 (App Router) + TypeScript · Port: 3000 · Users: DOCTOR, PHARMACIST
Calls only the gateway: `NEXT_PUBLIC_API_URL = http://localhost:8080/api/v1`

## 1. Purpose

Web portal used inside the hospital by doctors (today's appointments, patient details, consultation, prescription) and pharmacists (prescriptions, mark as done). Same login page for both; screens depend on the role. Backend: user-service, appointment-service, consultation-service through the gateway.

## 2. Tech

| Item | Choice |
|------|--------|
| Rendering | Client components for all screens (data is per-user and changes often); no server-side data fetching in v1 |
| HTTP | `fetch` wrapper adding `Authorization: Bearer <token>`, handling 401/503 |
| Forms | React Hook Form + zod |
| Token storage | `sessionStorage` + React context |
| Route guard | A client `AuthGuard` component in the `(doctor)` and `(pharmacy)` route-group layouts |

## 3. Register and Login

Same APIs as every app (user-service).

**Register** (`/register`) — Register as dropdown: **Doctor** / **Pharmacist**.

| Field | Doctor | Pharmacist |
|-------|--------|------------|
| Full name, phone, email (optional), password + confirm | ✔ | ✔ |
| Medical registration number | ✔ (must match what admin entered, with the same phone) | |
| Staff registration code | | ✔ |

**Login** (`/login`) — Login as dropdown: **Doctor** / **Pharmacist**, phone, password. Sends the chosen `role`.

After login:
```
if role == "DOCTOR"     → /doctor/today
if role == "PHARMACIST" → /pharmacy/prescriptions
```

## 4. Route Guard

| ID | Rule |
|----|------|
| CW-R1 | No token → `/login`. |
| CW-R2 | Token role is not DOCTOR or PHARMACIST → clear it, message "Please use the patient app / admin portal", → `/login`. |
| CW-R3 | Path starts `/doctor` and role ≠ DOCTOR → `/pharmacy/prescriptions`. |
| CW-R4 | Path starts `/pharmacy` and role ≠ PHARMACIST → `/doctor/today`. |
| CW-R5 | Logged in and on `/login` or `/register` → own home. |
| CW-R6 | API 401 → clear token → `/login`. 503 → toast "Service temporarily unavailable, please try again." |
| CW-R7 | On page refresh: `GET /auth/me`; 401 → `/login`. |

## 5. Menu

| Role | Menu |
|------|------|
| DOCTOR | Today's Appointments · Logout |
| PHARMACIST | Prescriptions · Logout |

## 6. Doctor Screens

| Route | Screen | API |
|-------|--------|-----|
| /doctor/today | Counts at top (total / completed / pending). Table by token: token, reporting time, patient, code, age, gender, status, **Open**. Refresh button | `GET /doctor/appointments/today` (appointment-service) |
| /doctor/consultations/[appointmentId] | Left: patient details (name, code, age, gender, phone, address) + last 5 visits. Right: consultation form — chief complaint, symptoms, temperature, pulse, BP (sys/dia), weight, diagnosis, private notes, advice, follow-up date — and prescription table (medicine, strength, dosage `1-0-1`, timing, days, instructions; add/remove rows). Buttons **Save** and **Complete Consultation** (confirm dialog). Read-only once completed | `GET/PUT /doctor/consultations/{id}`, `POST /doctor/consultations/{id}/complete` (consultation-service) |
| /doctor/patients/[patientId] | Patient details + full visit history | `GET /doctor/patients/{id}` (consultation-service) |

After **Complete**, return to `/doctor/today`. The row may show BOOKED for a few seconds until appointment-service processes the event; show a small note "Status updates in a few seconds" and refresh once after 3 seconds.

Client-side checks (server checks again): diagnosis required for Complete, dosage pattern `d-d-d`, vitals in range, follow-up date after today, max 20 medicines.

## 7. Pharmacist Screens

| Route | Screen | API |
|-------|--------|-----|
| /pharmacy/prescriptions | Tabs **Pending** (date picker, default today) and **Search** (patient code or appointment code). Table: token, patient, doctor, completed time, items count, **Open** | `GET /pharmacy/prescriptions/pending`, `GET /pharmacy/prescriptions/search` |
| /pharmacy/prescriptions/[consultationId] | Header: patient (name, code, age, gender), doctor, department, date, diagnosis. Prescription table. Remarks box. **Mark as Done** (confirm dialog). After done: "Given on 28-09-2026 11:20 by Priya", button hidden | `GET /pharmacy/prescriptions/{id}`, `POST /pharmacy/prescriptions/{id}/dispense` |

On `409 PHR_ALREADY_DISPENSED`: show "Already marked as done by another pharmacist" and reload.

## 8. Common UI Rules

| ID | Rule |
|----|------|
| CW-R8 | Show `fieldErrors` under inputs; 409 `message` as error toast. |
| CW-R9 | Disable Save / Complete / Mark as Done while a request is in flight. |
| CW-R10 | Dates dd-MM-yyyy, times hh:mm AM/PM. |
