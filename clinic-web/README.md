# clinic-web

Next.js 14 (App Router) + TypeScript web portal used inside the hospital by **Doctors** and
**Pharmacists**. Part of the HMS microservices platform (SVC-07C). Talks only to the API
gateway — never a backend service directly.

## Tech

- Next.js 14 (App Router), client components only (no server-side data fetching)
- TypeScript
- React Hook Form + zod for forms and validation
- Token kept in `sessionStorage`, exposed through a React context (`AuthContext`)
- A client `AuthGuard` component enforces the route rules in the `(doctor)` and `(pharmacy)`
  route groups

## Getting started

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.example` to `.env.local` and adjust if your gateway runs elsewhere:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/api/v1` | Base URL of the api-gateway. All requests go through this — the app never calls a backend service directly. |

The backend (api-gateway + user-service + appointment-service + consultation-service) does not
need to be running to build or browse the UI; it is required for login and all data screens to
work end-to-end.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server (after `build`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit/component tests |

## Structure

```
app/
  (auth)/login, (auth)/register       Shared login/register screens (Doctor/Pharmacist dropdown)
  (doctor)/doctor/today                Today's appointments (counts + token table)
  (doctor)/doctor/consultations/[id]   Consultation workspace (vitals, diagnosis, prescription)
  (doctor)/doctor/patients/[id]        Full patient visit history
  (pharmacy)/pharmacy/prescriptions    Pending / Search tabs
  (pharmacy)/pharmacy/prescriptions/[id]  Dispense detail + Mark as Done
components/      Shared UI: AuthGuard, AppHeader, ConfirmDialog, PrescriptionTable, ...
context/         AuthContext (token + user), ToastContext (error/success toasts)
hooks/           useApiError — maps API errors to toasts / field errors / logout+redirect
lib/             apiClient (fetch wrapper), types, format helpers, zod schemas
```

## Key behaviors

- **Route guards** (`CW-R1`–`CW-R7`): no token → `/login`; wrong-portal role → cleared + redirected
  with a message; doctor routes reject non-doctors (and vice versa); already-logged-in users
  visiting `/login` or `/register` are sent to their own home; a 401 from any API call clears the
  session and redirects to `/login`; on refresh the app re-validates via `GET /auth/me`.
- **Consultation workspace**: Save can be repeated; Complete asks for confirmation, requires a
  diagnosis, and becomes read-only afterwards. Because `appointment-service` applies the
  `COMPLETED` status asynchronously (via Kafka), the Today list shows a "status updates in a few
  seconds" note and refreshes once more ~3 seconds after returning from Complete.
- **Pharmacist dispense race**: a `409 PHR_ALREADY_DISPENSED` response while marking a prescription
  as done shows "Already marked as done by another pharmacist" and reloads the detail screen.
- **Formatting**: dates as `dd-MM-yyyy`, times as `hh:mm AM/PM` (see `lib/format.ts`).
