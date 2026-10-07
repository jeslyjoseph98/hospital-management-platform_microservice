# patient-app

Flutter 3 (Dart) app for the PATIENT role — register, log in, book appointments
(department → doctor → date), view booking confirmations, track upcoming/past
appointments, see the consultation summary and prescription after a visit,
and receive notifications. Talks only to the API gateway (`api-gateway`,
SVC-01) — never directly to a backend service.

> **Flutter SDK required to run.** This project was written by hand in an
> environment without the Flutter/Dart SDK installed, so it could **not** be
> verified with `flutter pub get`, `flutter analyze`, `flutter test`, or
> `flutter run`. Before first use, run `flutter analyze` and fix anything it
> flags — the code was written carefully for syntax correctness (balanced
> braces, null-safety, imports), but there is no substitute for the real
> compiler/analyzer.

## Tech stack (per SVC-07B §2)

| Concern | Package |
|---|---|
| HTTP | `dio`, with an interceptor adding `Authorization: Bearer <token>` and handling 401/503 |
| State | `provider` (`ChangeNotifier`) — `AuthProvider`, `BookingProvider`, `NotificationProvider` |
| Token storage | `flutter_secure_storage` |
| Navigation | `go_router`, with a `redirect` function implementing the route guard (PA-R1..PA-R5) |
| Dates/times | `intl` — dd-MM-yyyy dates, hh:mm AM/PM times (PA-R8) |

## Project layout

```
lib/
 ├── api/            ApiClient (dio + interceptor), ApiException, TokenStorage, HmsApi (all endpoint calls)
 ├── models/         Plain Dart classes with fromJson for every API payload
 ├── providers/      AuthProvider, BookingProvider, NotificationProvider
 ├── screens/
 │    ├── auth/              Login, Register
 │    ├── booking/           Departments, Doctors, Date+Availability, Booking Success
 │    ├── appointments/      My Appointments (Upcoming/Past tabs), Appointment Detail
 │    ├── notifications/     Notifications list
 │    ├── profile/           Profile + Logout
 │    ├── home_shell.dart    Bottom navigation (Book / My Appointments / Notifications / Profile)
 │    └── splash_screen.dart Shown while the stored token is validated on launch
 ├── utils/          Formatters (dd-MM-yyyy / hh:mm a), ErrorPresenter (503 / no-internet snackbars)
 ├── router.dart     go_router config + redirect-based route guard
 └── main.dart       Wires ApiClient/providers together, app entry point
```

## Running

```bash
flutter pub get

# Android emulator
flutter run --dart-define=API_URL=http://10.0.2.2:8080/api/v1

# Web or iOS simulator
flutter run --dart-define=API_URL=http://localhost:8080/api/v1
```

`API_URL` must point at the gateway's `/api/v1` base path (see SVC-00 §9 and
SVC-07B header). If `API_URL` is not supplied, it defaults to
`http://localhost:8080/api/v1` (see `lib/main.dart`).

To build a release web bundle served on port 8090 (per SVC-00 §2 table):

```bash
flutter build web --dart-define=API_URL=http://localhost:8080/api/v1
```

## What's implemented

- **Auth**: Register (fixed role Patient, full name, phone, email optional,
  password + confirm, date-of-birth picker, gender dropdown, address
  optional) and Login (phone + password), both always sending
  `role: "PATIENT"` to `/auth/register` / `/auth/login` (SVC-02 §6).
- **Route guard** (`lib/router.dart`, PA-R1..PA-R5): no token → Login; wrong
  role → cleared + "This app is for patients" + Login; logged in on
  Login/Register → Home; a 401 from any API call clears the token and routes
  to Login; app start validates any stored token via `GET /auth/me`.
- **Bottom navigation**: Book, My Appointments, Notifications (badge with
  live unread count), Profile — built with `go_router`'s
  `StatefulShellRoute.indexedStack` so each tab keeps its own navigation
  stack.
- **Booking flow**: Departments list → Doctor cards (qualification,
  specialization, experience, fee, weekly timings) → 7-day availability strip
  (seats left / fully booked / not available / closed, only AVAILABLE days
  tappable) → optional reason → Confirm Booking (disabled while in flight,
  PA-R7) → Booking Success screen with token number, reporting time and
  booking details. 409 conflicts (fully booked / already booked / booking
  closed) show a dialog with the server message and reload availability.
- **My Appointments**: Upcoming / Past tabs via `GET /appointments/my`.
- **Appointment Detail**: booking slip always; if `status = COMPLETED`, also
  fetches `GET /consultations/my/{appointmentId}` and shows diagnosis,
  advice, follow-up date, prescription items, and the dispense message
  ("Medicines given on …" / "Medicines not yet collected").
- **Notifications**: list newest-first, unread in bold, tap marks read
  (`PATCH /notifications/{id}/read`) and opens the related appointment.
  Unread-count polling (`GET /notifications/my/unread-count`) on launch, on
  app-foreground resume, and every 30 seconds while open (SVC-07B §5),
  implemented via `WidgetsBindingObserver` + a periodic `Timer` in
  `NotificationProvider`.
- **Profile**: own details from `GET /patients/me`, Logout button (clears the
  secure-storage token and stops notification polling).
- **Common UI rules**: `fieldErrors` from the standard error envelope are
  shown under the matching form field (PA-R6); Confirm Booking is disabled
  while its request is in flight (PA-R7); all dates render dd-MM-yyyy and all
  times render hh:mm AM/PM via the `Formatters` helper (PA-R8); 503 responses
  and network failures always surface as a snackbar ("Service temporarily
  unavailable, please try again." / "No internet connection") regardless of
  which screen triggered the call.

## Known deviations / judgment calls

- **Department list field name**: SVC-03 §4.1 only shows the JSON shape for
  `GET /departments/{id}/doctors`, not for `GET /departments` itself. The
  `Department` model reads `deptName` (matching the table column converted to
  camelCase per SVC-00 §5) with a fallback to `name` in case the backend team
  chose a shorter key — harmless either way since only one key will be
  present.
- **Appointment JSON shape**: SVC-04 only gives an explicit JSON example for
  the booking response (§5.3), not for `GET /appointments/my` or
  `GET /appointments/{id}`. The `Appointment` model is built from the
  `appointments` table columns (§2) converted to camelCase, with `id` as a
  fallback key for `appointmentId` in case the detail endpoint reuses the raw
  column name.
- **Consultation summary dispense message**: SVC-05 §6 (PAT-R2) specifies the
  three possible messages ("Medicines given on {date}" + remarks / "Medicines
  not yet collected" / nothing) but not the exact JSON field name. The
  `ConsultationSummary` model first looks for a precomposed `dispenseMessage`
  string and, if absent, derives the same three outcomes from a structured
  `dispense: { status, at, remarks }` object — whichever shape the backend
  sends, the UI text matches the spec.
- **`myConsultation` 404 handling**: a 404 from `GET /consultations/my/{id}`
  (`DRC_NOT_FOUND`) is treated as "not completed yet" rather than an error,
  since the Appointment Detail screen already gates the call behind
  `status == COMPLETED` but the two services could disagree transiently.
- No `json_serializable`/build_runner — models use plain hand-written
  `fromJson` constructors per the spec's "or" option, since code generation
  isn't runnable without the Flutter/Dart SDK in this environment.
- Platform folders (`android/`, `ios/`, `web/`, etc.) were intentionally not
  scaffolded, per the task instructions — only `pubspec.yaml` and `lib/` are
  provided. Running `flutter create .` in this directory (or `flutter run`,
  which scaffolds on demand) will add them.

## Recommended next step

Run `flutter pub get && flutter analyze` once the Flutter SDK is available,
and fix any analyzer warnings/errors before the first `flutter run`.
