# HMS Microservices — SVC-07A admin-web (React)

Version: 1.0
Stack: A — React 18 + Vite + TypeScript · Port: 5173 · Users: ADMIN
Calls only the gateway: `VITE_API_URL = http://localhost:8080/api/v1`

## 1. Purpose

Web app for hospital admins: departments, doctors (profile, qualification, consultation details, weekly timings), and bookings per doctor. Backend: doctor-service and appointment-service through the gateway.

## 2. Tech

| Item | Choice |
|------|--------|
| Routing | React Router 6 |
| HTTP | `fetch` wrapper (or axios) that adds `Authorization: Bearer <token>` and handles 401/503 |
| Forms | React Hook Form + zod |
| State | React context for the logged-in user; no global store needed |
| Token storage | `sessionStorage` |

## 3. Register and Login

Same APIs as every app (user-service): `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.

| Screen | Fields |
|--------|--------|
| `/register` | Register as: **Admin** (fixed, no other options). Full name, phone, email (optional), password + confirm, admin registration code |
| `/login` | Login as: **Admin** (fixed). Phone, password |

Requests always send `role: "ADMIN"`. After login → `/admin/doctors`.

## 4. Route Guard

| ID | Rule |
|----|------|
| AW-R1 | No token → `/login`. |
| AW-R2 | Token role ≠ ADMIN (e.g. a token copied from another app) → clear it, show "Please use the patient app / clinic portal", → `/login`. |
| AW-R3 | Logged-in admin opens `/login` or `/register` → `/admin/doctors`. |
| AW-R4 | Any API 401 → clear token → `/login`. Any 503 → toast "Service temporarily unavailable, please try again." |
| AW-R5 | On page refresh: `GET /auth/me`; on 401 → `/login`. |

## 5. Menu

Doctors · Departments · Bookings · Logout

## 6. Screens

| Route | Screen | API |
|-------|--------|-----|
| /admin/departments | Table: name, active doctors, status. Buttons Add, Edit, Activate/Deactivate | `GET/POST /admin/departments`, `PUT /admin/departments/{id}`, `PATCH /admin/departments/{id}/status` |
| /admin/doctors | Filter by department and name; table: name, department, specialization, fee, daily limit, days, login registered (Yes/No), status; paging | `GET /admin/doctors` |
| /admin/doctors/new | Form (section 7) | `POST /admin/doctors` |
| /admin/doctors/{id} | Same form, filled; separate **Save timings** button; Activate/Deactivate | `GET/PUT /admin/doctors/{id}`, `PUT /admin/doctors/{id}/timings`, `PATCH /admin/doctors/{id}/status` |
| /admin/bookings | Pick department → doctor → date. Shows "38 / 50" and token list (token, patient, code, reporting time, status) | `GET /admin/appointments?doctorId=&date=` + `dailyLimit` from `GET /admin/doctors/{id}` |

## 7. Doctor Form

| Section | Fields |
|---------|--------|
| 1. Profile | Full name, department (dropdown of active departments), qualification, specialization, medical registration number (read-only once `loginRegistered`), experience (years), phone, email, about |
| 2. Consultation | Consultation fee (₹), daily appointment limit (default 50) |
| 3. Weekly timings | 7 rows Monday–Sunday: checkbox + start time + end time |

Client-side checks (server checks again): required fields, phone 10 digits starting 6–9, end time after start time.

On `409` with `data.affected` (e.g. `ADM_DAY_HAS_BOOKINGS`, `ADM_LIMIT_BELOW_BOOKED`, `ADM_DOCTOR_HAS_BOOKINGS`): show the message and a small table of affected dates and booked counts.

## 8. Common UI Rules

| ID | Rule |
|----|------|
| AW-R6 | Show `fieldErrors` under matching inputs; show 409 `message` as an error toast. |
| AW-R7 | Disable submit buttons while a request is in flight. |
| AW-R8 | Dates dd-MM-yyyy, times hh:mm AM/PM, fee as ₹500.00. |
