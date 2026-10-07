# HMS Microservices — SVC-07B patient-app (Flutter)

Version: 1.0
Stack: B — Flutter 3 (Dart) · Android, iOS, web (web build served on port 8090) · Users: PATIENT
Calls only the gateway: `--dart-define=API_URL=...` (Android emulator `http://10.0.2.2:8080/api/v1`, web/iOS simulator `http://localhost:8080/api/v1`)

## 1. Purpose

Patient app: register, log in, choose department → doctor → date, book, see token and reporting time, see notifications, view appointments and the consultation summary / prescription after the visit. Backend: user-service, doctor-service, appointment-service, consultation-service, notification-service through the gateway.

## 2. Tech

| Item | Choice |
|------|--------|
| HTTP | `dio` with an interceptor that adds `Authorization: Bearer <token>` and handles 401/503 |
| State | `provider` (ChangeNotifier) — `AuthProvider`, `BookingProvider`, `NotificationProvider` |
| Token storage | `flutter_secure_storage` |
| Navigation | `go_router` with a redirect function (route guard) |
| Models | Plain Dart classes with `fromJson` (or `json_serializable`) |

## 3. Register and Login

Same APIs as every app (user-service).

| Screen | Fields |
|--------|--------|
| Register | Register as: **Patient** (fixed). Full name, phone, email (optional), password + confirm, date of birth (date picker), gender (Male/Female/Other), address (optional) |
| Login | Login as: **Patient** (fixed). Phone, password |

Requests always send `role: "PATIENT"`. On register success: "Registration successful. Please log in." → Login. After login → Home (Book Appointment).

## 4. Route Guard (`go_router` redirect)

| ID | Rule |
|----|------|
| PA-R1 | No token → Login. |
| PA-R2 | Token role ≠ PATIENT → clear it, message "This app is for patients", → Login. |
| PA-R3 | Logged in and on Login/Register → Home. |
| PA-R4 | API 401 → clear token → Login. 503 → snackbar "Service temporarily unavailable, please try again." No network → snackbar "No internet connection". |
| PA-R5 | App start: if a token is stored, call `GET /auth/me`; 401 → Login. |

## 5. Navigation

Bottom navigation: **Book** · **My Appointments** · **Notifications** (badge with unread count) · **Profile** (shows details from `GET /patients/me`, Logout button).

Badge count: `GET /notifications/my/unread-count` on app start, when the app returns to foreground, and every 30 seconds while open.

## 6. Screens

| Screen | Content | API |
|--------|---------|-----|
| Book — Departments | List of departments | `GET /departments` |
| Book — Doctors | Doctor cards: name, qualification, specialization, experience, fee, weekly timings | `GET /departments/{id}/doctors` |
| Book — Date | Horizontal 7-day strip; each chip shows day/date and "12 left" / "Fully booked" / "Not available" / "Closed"; only AVAILABLE is tappable. Reason text field. **Confirm Booking** | `GET /doctors/{id}/availability`, `POST /appointments` |
| Booking Success | Large token number, reporting time, doctor, department, date, appointment code. Green snackbar "Booking successful" (from the POST response message) | POST response |
| My Appointments | Tabs Upcoming / Past: date, doctor, department, token, status | `GET /appointments/my?upcoming=true/false` |
| Appointment Detail | Booking slip. If COMPLETED: diagnosis, advice, follow-up date, prescription list (medicine, strength, `1-0-1`, timing, days), "Medicines given on …" or "Medicines not yet collected" | `GET /appointments/{id}`, `GET /consultations/my/{appointmentId}` |
| Notifications | List newest first; unread in bold; tap → mark read and open the appointment | `GET /notifications/my`, `PATCH /notifications/{id}/read` |

Booking errors: on `409` (`APT_DOCTOR_FULLY_BOOKED`, `APT_ALREADY_BOOKED`, `APT_BOOKING_CLOSED`) show the `message` in a dialog and reload availability.

## 7. Common UI Rules

| ID | Rule |
|----|------|
| PA-R6 | Show `fieldErrors` under matching inputs. |
| PA-R7 | Disable **Confirm Booking** while the request is in flight (prevents double booking taps). |
| PA-R8 | Dates dd-MM-yyyy, times hh:mm AM/PM (package `intl`). |
