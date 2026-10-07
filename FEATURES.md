# HMS — Feature List (generated from `hms-microservice-specs/`)

Derived from SVC-00 through SVC-07C. Organized by service/component. Each feature lists its
purpose, key rules, and the APIs or events that implement it. Scope excludes cancellation/
rescheduling, lab tests, billing, medicine stock, and SMS/email (explicitly out of scope per
SVC-00).

Roles: **PATIENT**, **ADMIN**, **DOCTOR**, **PHARMACIST**.

---

## SVC-01 — api-gateway (Spring Cloud Gateway, Java 21, port 8080)

Single public entry point. No business logic, no database.

- **JWT authentication** — validates HS256 JWT on every route except `/api/v1/auth/**`; missing/invalid/expired token → 401 `AUTH_TOKEN_INVALID`.
- **Role-based routing/authorization** — each path is mapped to one allowed role (PATIENT/ADMIN/DOCTOR/PHARMACIST); mismatched role → 403 `AUTH_FORBIDDEN`.
- **Identity header injection** — strips any client-supplied `X-User-*`/`X-Patient-Id`/`X-Doctor-Id` headers and re-sets them from the verified token, so downstream services can trust them.
- **Request correlation IDs** — generates `X-Request-Id` when absent and echoes it in the response.
- **Service routing table** — routes `/auth/**`, `/patients/me`, `/doctors/**`, `/departments/**`, `/appointments/**`, `/consultations/my/**`, `/notifications/**`, `/admin/**`, `/doctor/**`, `/pharmacy/**` to the correct backend; unmatched paths (including `/internal/**`) → 404.
- **Upstream outage handling** — target service down/unresponsive within 10s → 503 `SERVICE_UNAVAILABLE` in the standard error envelope.
- **CORS** — allows configured frontend origins (admin-web, clinic-web, patient-app web build) for GET/POST/PUT/PATCH/DELETE with `Authorization`/`Content-Type` headers.

---

## SVC-02 — user-service (Spring Boot, MySQL `hms_user`, port 8081)

Owns accounts, authentication, and patient profiles for all four roles.

### Registration
- **Role-specific registration** — one `/auth/register` endpoint accepting different required fields per role (Patient: DOB/gender/address; Doctor: registration number; Pharmacist: staff code; Admin: admin code).
- **Field validation** — full name/phone/password required; phone must be 10 digits starting 6–9; password ≥8 chars with a letter and a digit; DOB not in the future.
- **Uniqueness checks** — duplicate phone or email rejected (`REG_PHONE_EXISTS`, `REG_EMAIL_EXISTS`), including a race-safe fallback on unique-constraint violation.
- **Gated role registration** — ADMIN and PHARMACIST signup requires a correct shared registration code (`adminCode` / `staffCode`) from config.
- **Doctor self-registration linked to admin-created profile** — doctor registration calls doctor-service to verify `registrationNumber` + `phone` match a profile the admin already created; rejects if not found, phone mismatch, inactive, or already registered; propagates 503 if doctor-service is down.
- **Patient code generation** — auto-generates `PATxxxxxx` code after insert.
- **Doctor-account-registered event** — publishes `user.doctor-account-registered` (via outbox) on successful doctor registration, consumed by doctor-service to flag `login_registered`.

### Login & session
- **Unified login across all three frontends** — single `/auth/login` used by admin-web, patient-app, and clinic-web; role mismatch and bad credentials return indistinguishable errors until after password check (prevents phone enumeration).
- **Account active/inactive enforcement** — inactive accounts (including doctors deactivated by admin, synced via `doctor.status-changed`) are blocked at login.
- **JWT issuance** — HS256 token with user id, role, name, and role-specific claims (`patientId`/`patientCode` or `doctorId`); configurable expiry.
- **Current-user lookup** (`/auth/me`) — self-validates the bearer token (bypasses gateway's open `/auth/**` prefix).
- **Patient self-profile** (`/patients/me`) — returns own profile including computed age.

### Internal/eventing
- **Internal patient lookup** (`/internal/patients/{id}`) — used by appointment-service and consultation-service to fetch/snapshot patient details.
- **Doctor status sync consumer** — consumes `doctor.status-changed` to flip a doctor-login's `is_active` flag, idempotently.

---

## SVC-03 — doctor-service (Spring Boot, MySQL `hms_doctor`, port 8082)

Owns departments, doctor profiles, consultation details, and weekly schedules.

### Department management (Admin)
- **CRUD for departments** — create (unique name, case-insensitive), update name/description, activate/deactivate.
- **Deactivation guard** — cannot deactivate a department that still has active doctors.
- **Soft-delete only** — departments and doctors are never hard-deleted.

### Doctor profile management (Admin)
- **Doctor onboarding** — create profile (department, qualification, specialization, unique registration number, experience, phone, fee, daily limit) together with weekly timings in one transaction.
- **Profile validation** — fee ≥0, experience 0–70, phone format, daily limit 1–200 (default 50), department must be active.
- **Doctor directory with filters** — admin list view filterable by department/name/active, paginated; patient-facing list limited to active doctors of active departments with PII fields (registration number, phone, email, login status) hidden.
- **Safe daily-limit reduction** — lowering a doctor's daily limit is blocked if any future date already has more bookings than the new limit (checked via appointment-service future-counts).
- **Registration-number lock** — once a doctor has logged in (linked to a user account), their registration number becomes immutable.
- **Activate/deactivate doctor** — blocked if the doctor has any future bookings; successful change publishes `doctor.status-changed` and hides the doctor from patient-facing lists/booking.

### Weekly availability management (Admin)
- **Full-week timing replacement** — admin always submits the complete week; rejects duplicate days, invalid time ranges, or a window too short to fit the daily limit (≥1 minute/token).
- **Booking-safe schedule edits** — removing a day or moving its start time earlier is blocked if future bookings exist on that weekday; extending end time is always allowed.

### Patient-facing reads
- **Browse departments → doctors** — active departments; active doctors per department with qualification, specialization, experience, fee, bio, and weekly timings, with sensitive fields stripped.

### Internal/eventing
- **Doctor registration verification** (`/internal/doctors/verify-registration`) — used by user-service during doctor self-registration.
- **Weekly schedule lookup** (`/internal/doctors/{id}/weekly-schedule`) — used by appointment-service for availability/booking, includes active flag reflecting department status too.
- **Future-booking-count queries to appointment-service** — used to safely gate limit reductions, schedule edits, and deactivation.
- **`login_registered` sync consumer** — consumes `user.doctor-account-registered` to mark a doctor profile as linked to a login.

---

## SVC-04 — appointment-service (Node.js/Express, PostgreSQL `hms_appointment`, port 8083)

Owns the booking engine: availability, concurrency-safe slot allocation, tokens, and status.

- **7-day availability view** — per doctor, computes AVAILABLE / FULLY_BOOKED / NOT_AVAILABLE / CLOSED for today + next 6 days, combining doctor-service's weekly schedule with live booked counts.
- **Concurrency-safe booking** — row-locked per-doctor-per-day counter (`SELECT ... FOR UPDATE`) plus unique constraints as a second safety net, guaranteeing no more than `dailyLimit` bookings per doctor per day even under simultaneous requests.
- **Booking business rules** — date must be within the 7-day window; doctor must have availability that weekday; today's bookings close once consultation hours end; a patient can't double-book the same doctor/date; full slots return `APT_DOCTOR_FULLY_BOOKED`.
- **Token number & reporting time calculation** — sequential token per doctor/day; reporting time computed from slot window, daily limit, and token position.
- **Snapshotting** — copies patient and doctor/department details onto the appointment row at booking time (names, codes, gender, DOB) so later admin changes don't rewrite history.
- **Appointment code generation** — `APTxxxxxxxx` assigned post-insert.
- **Patient's appointment history** — own upcoming/past appointments and single booking-slip detail; access restricted to the owning patient.
- **Doctor's today list** — today's appointments for the logged-in doctor ordered by token, with total/completed/pending counts.
- **Admin bookings view** — bookings for a given doctor/date with token list and status, for the admin console.
- **Status lifecycle** — BOOKED → COMPLETED, driven by consuming `consultation.completed` (idempotent update).
- **appointment.booked event** — published (via outbox) on every successful booking, consumed by notification-service.
- **Internal appointment lookups** — `/internal/appointments/{id}`, `/internal/appointments/exists`, and `/internal/appointments/future-counts` serve consultation-service and doctor-service.

---

## SVC-05 — consultation-service (Python/FastAPI, MongoDB `hms_consultation`, port 8084)

Owns everything after the patient reaches the doctor: consultation records, prescriptions, and dispensing.

### Doctor workflow
- **Open appointment / consultation workspace** — fetches (or lazily creates) the consultation doc for an appointment, with patient details fetched live from user-service and the patient's last 5 completed visits for context; enforces the appointment belongs to the requesting doctor.
- **Save consultation (repeatable draft)** — only for today's appointment, only while BOOKED/IN_PROGRESS; validates vitals ranges (temperature, pulse, BP, weight), follow-up date must be in the future, and prescription constraints (0–20 items, dosage pattern `d-d-d`, valid timing, duration 1–365 days).
- **Prescription authoring** — full prescription array replaced on each save (medicine name, strength, dosage pattern, timing, duration, instructions).
- **Complete consultation** — requires diagnosis; atomically marks the consultation COMPLETED, sets dispense status (PENDING if there are prescription items, else NOT_REQUIRED), and publishes `consultation.completed` in the same transaction; idempotent against double-completion.
- **Read-only after completion** — further edits to a completed consultation are rejected.
- **Patient detail + full visit history for a doctor** — restricted to patients who have actually booked with that doctor; shows all past completed consultations across any doctor (sorted newest-first) with diagnosis, advice, prescriptions, and dispense status, excluding private doctor notes.

### Pharmacist workflow
- **Pending-dispense queue** — completed consultations with items awaiting dispensing, filterable by date (hospital-timezone day boundaries).
- **Search by patient/appointment code** — finds recent (≤30 days) consultations regardless of dispense status.
- **Prescription detail view** — patient/doctor/consultation summary and prescription items, with doctor's private notes and vitals excluded.
- **Mark as dispensed** — atomic conditional update (only from PENDING) prevents two pharmacists double-marking the same prescription; optional remarks; DISPENSED is final/irreversible.

### Patient workflow
- **View own consultation summary & prescription** — only once COMPLETED and only for the owning patient; shows diagnosis, advice, follow-up date, vitals, prescription, and a dispense status message ("given on {date}" / "not yet collected"); private doctor notes never exposed.

### Cross-cutting
- **One-document-per-appointment model** — consultation, vitals, and prescription are embedded in a single Mongo document per appointment (unique index on `appointmentId`).
- **Snapshotting** — appointment/patient/doctor details copied onto the consultation document at first save.
- **consultation.completed event** — published via transactional outbox, consumed by appointment-service to flip appointment status.

---

## SVC-06 — notification-service (Node.js/Express, PostgreSQL `hms_notification`, port 8085)

Stores and serves patient-facing notifications (bell icon); no email/SMS.

- **Booking-confirmation notification** — consumes `appointment.booked` and inserts a notification with a templated message ("Your appointment with {doctor} ({department}) on {date} is confirmed. Token No: {n}. Please report by {time}.").
- **Idempotent event consumption** — unique constraint on the Kafka event id prevents duplicate notifications on redelivery.
- **Notification inbox** — paginated list of a patient's own notifications, newest first.
- **Unread count badge** — endpoint for the bell-icon badge count.
- **Mark as read** — single-notification mark-read, restricted to the owning patient; idempotent (re-marking a read notification is a no-op).

---

## SVC-07A — admin-web (React + Vite, port 5173)

Web console for ADMIN.

- **Admin-only auth flow** — fixed-role register/login screens, route guard redirecting unauthenticated or wrong-role tokens to login, session restore via `/auth/me` on refresh.
- **Department management screen** — table with status, add/edit/activate/deactivate actions.
- **Doctor directory screen** — filter by department/name, paginated table showing fee, daily limit, schedule days, login-registered status, active status.
- **Doctor create/edit form** — profile, consultation details (fee, daily limit), and a 7-row weekly timings editor (checkbox + start/end time per day) with a separate "Save timings" action; registration number becomes read-only once the doctor has logged in.
- **Bookings-by-doctor-and-date screen** — department → doctor → date drill-down showing "booked / limit" and the token list.
- **Conflict-aware error display** — surfaces 409 responses that include `data.affected` (blocked day removal, limit reduction, deactivation) as a small table of affected dates/counts, alongside field-level and toast error handling.

---

## SVC-07B — patient-app (Flutter: Android/iOS/web, port 8090 web)

Mobile/web app for PATIENT — the primary end-user booking journey.

- **Patient-only auth flow** — fixed-role register (with DOB picker, gender, address) and login, secure token storage, route-guard redirects, session restore on launch.
- **Department → doctor → date booking flow** — browse departments, browse doctor cards (qualification, experience, fee, timings), 7-day date strip showing live slot status (seats-left / fully booked / not available / closed) with only available days tappable, optional reason field, single-tap confirm with submit-button debounce to prevent double booking.
- **Booking success screen** — token number, reporting time, and booking details shown immediately from the booking response.
- **My Appointments** — upcoming/past tabs backed by appointment history.
- **Appointment detail / booking slip** — shows prescription and "medicines given/not yet collected" once the visit is completed.
- **Notifications inbox with unread badge** — polled on launch, on foreground, and every 30s; tapping a notification marks it read and opens the related appointment.
- **Profile screen** — own patient profile and logout.
- **Booking-conflict handling** — 409 errors (fully booked / already booked / booking closed) shown as a dialog with automatic availability reload.

---

## SVC-07C — clinic-web (Next.js, port 3000)

Shared web portal for DOCTOR and PHARMACIST, with role-based screens behind one login.

- **Dual-role auth flow** — one login/register page offering Doctor/Pharmacist, role-aware post-login redirect, and route guards that bounce a doctor out of pharmacy routes (and vice versa).
- **Doctor — Today's Appointments** — token-ordered list with total/completed/pending counts and an "Open" action per row.
- **Doctor — Consultation workspace** — patient details + last-5-visit history alongside a consultation form (vitals, diagnosis, private notes, advice, follow-up date) and an editable prescription table; Save vs. Complete Consultation (with confirmation), becoming read-only after completion; polls/refreshes shortly after completion since appointment-service updates asynchronously.
- **Doctor — Patient history screen** — full visit history for a given patient.
- **Pharmacist — Prescriptions queue** — Pending (date-filtered) and Search (by patient/appointment code) tabs.
- **Pharmacist — Dispense screen** — prescription detail, remarks field, Mark as Done with confirmation; handles "already dispensed by another pharmacist" race gracefully.

---

## Cross-cutting platform features (SVC-00)

These aren't user-facing screens but are foundational capabilities every service implements:

- **Database-per-service isolation** — no cross-service joins or foreign keys; references to other services' records are plain IDs.
- **Snapshot-vs-sync data strategy** — point-in-time snapshots for historical/display data, live sync calls when the answer affects a business decision.
- **Standard sync-call resilience** — 2s connect / 5s read timeouts; any failure of a dependency → 503 `SERVICE_UNAVAILABLE` with nothing saved.
- **Transactional outbox pattern** — every event-publishing service writes outbox rows in the same transaction as the business change; a 2-second polling job publishes to Kafka, tolerant of at-least-once delivery.
- **Idempotent event consumers** — every Kafka consumer is safe to process the same message twice.
- **Uniform API envelope** — consistent success/error JSON shape, field-level validation errors, and a shared error-code vocabulary across all services.
- **Gateway-trusted identity propagation** — business services never validate JWTs themselves; they trust `X-User-*` headers set by the gateway.
- **Request tracing** — `X-Request-Id` propagated through sync calls and Kafka headers for cross-service log correlation.
- **Hospital-timezone date handling** — "today" and day boundaries computed in `Asia/Kolkata` consistently across Java, Node, and Python.
