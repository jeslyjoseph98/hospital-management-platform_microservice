# admin-web

React 18 + Vite + TypeScript web console for hospital **ADMIN** users (SVC-07A). Manages departments, doctors (profile, consultation details, weekly timings) and lets admins browse bookings by doctor and date.

This app talks only to the API gateway — it never calls a backend service directly.

## Tech

- React 18, Vite, TypeScript
- React Router 6 (route guard, `/login`, `/register`, `/admin/**`)
- React Hook Form + zod (forms and client-side validation)
- `fetch`-based typed API client (`src/api/client.ts`) with a single place that attaches
  `Authorization: Bearer <token>`, redirects to `/login` on 401, and toasts on 503
- Vitest + React Testing Library for unit/component tests

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on **http://localhost:5173**.

### Environment variables

Create a `.env` file (see `.env.example`) if you need to override the default gateway URL:

```
VITE_API_URL=http://localhost:8080/api/v1
```

If `VITE_API_URL` is not set, the app defaults to `http://localhost:8080/api/v1`.

The backend (api-gateway + user-service + doctor-service + appointment-service) does not need
to be running to build or browse this app's UI, but all data screens require a live gateway to
load data.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  api/            Typed fetch wrapper + per-resource API modules (auth, departments, doctors, bookings)
  components/     Shared UI: layout/menu, form field, weekly timings editor, error/affected-rows banners
  context/        AuthContext (session/user state) and ToastContext (toasts for 503 / success / error)
  pages/          One file per screen (Login, Register, Departments, Doctors list/create/edit, Bookings)
  routes/         RequireAdmin route guard + RedirectIfAuthenticated
  types/          API envelope types and domain types mirrored from the specs
  utils/          Formatting (dates/times/fee), field-error mapping, doctor form zod schema
  __tests__/      Vitest + Testing Library tests
```

## Auth and route guard (AW-R1..AW-R5)

- Token is stored in `sessionStorage` only (cleared on tab close), never persisted longer.
- `GET /auth/me` is called on page load if a token is present, to restore the session and
  validate the token is still good (AW-R5).
- A token for a non-ADMIN role is rejected client-side and the user is sent back to `/login`
  (AW-R2) — this app only serves the ADMIN role.
- Any API response with HTTP 401 clears the token and routes to `/login` (AW-R4).
- Any API response with HTTP 503 raises a toast: "Service temporarily unavailable, please try
  again." (AW-R4).
- A logged-in admin opening `/login` or `/register` is redirected to `/admin/doctors` (AW-R3).

## Notes / deviations from spec

- The spec does not prescribe exact department/doctor list UI (modal vs. inline forms); the
  department add/edit form is implemented as a modal dialog over the table, while the doctor
  form is a full page (`/admin/doctors/new`, `/admin/doctors/:id`) per the routes table in
  SVC-07A §6.
- Pagination controls (Previous/Next + "Page X of Y") are a straightforward interpretation of
  "paged" doctors list filtering in SVC-03 §4.2; the exact param names (`page`, `size`) and
  response shape (`content`, `totalElements`, `totalPages`) follow common Spring Data
  conventions since the spec does not give an literal JSON example for the paged admin list.
