# HMS Microservices — SVC-01 api-gateway

Version: 2.0
Stack: A · Port: 8080 (the only backend port published to the host)
Technology: Spring Cloud Gateway (WebFlux), Java 21
Database: none

## 1. Responsibilities

1. Single entry point for the frontend.
2. Validate the JWT on every route except `/api/v1/auth/**`.
3. Check the role allowed for the path.
4. Remove any incoming `X-User-*`, `X-Patient-Id`, `X-Doctor-Id` headers, then set them from the token.
5. Add `X-Request-Id` if missing.
6. Route to the right service.
7. CORS for the frontend origin.

No business logic.

## 2. JWT Validation

| Item | Value |
|------|-------|
| Algorithm | HS256 |
| Secret | env `HMS_JWT_SECRET` (same value as user-service) |
| Required claims | `sub`, `role`, `name`, `exp`; `patientId` if role PATIENT; `doctorId` if role DOCTOR |

## 3. Routes and Roles

Matched top to bottom; specific paths come first.

| # | Path | Allowed role | Target |
|---|------|--------------|--------|
| 1 | `/api/v1/auth/**` | public | `http://user-service:8081` |
| 2 | `/api/v1/patients/me` | PATIENT | user-service |
| 3 | `/api/v1/doctors/*/availability` | PATIENT | `http://appointment-service:8083` (Node) |
| 4 | `/api/v1/departments/**` | PATIENT | `http://doctor-service:8082` |
| 5 | `/api/v1/doctors/**` | PATIENT | doctor-service |
| 6 | `/api/v1/appointments/**` | PATIENT | appointment-service |
| 7 | `/api/v1/consultations/my/**` | PATIENT | `http://consultation-service:8084` (Python) |
| 8 | `/api/v1/notifications/**` | PATIENT | `http://notification-service:8085` (Node) |
| 9 | `/api/v1/admin/appointments/**` | ADMIN | appointment-service |
| 10 | `/api/v1/admin/**` | ADMIN | doctor-service |
| 11 | `/api/v1/doctor/appointments/**` | DOCTOR | appointment-service |
| 12 | `/api/v1/doctor/**` | DOCTOR | consultation-service |
| 13 | `/api/v1/pharmacy/**` | PHARMACIST | consultation-service |
| — | anything else (incl. `/internal/**`) | — | 404 |

## 4. Rules

| ID | Rule |
|----|------|
| GW-R1 | Route 1 skips token checks. |
| GW-R2 | Any other route: no `Authorization: Bearer` header, bad signature, or expired → 401 `AUTH_TOKEN_INVALID`. |
| GW-R3 | Token `role` ≠ allowed role of the route → 403 `AUTH_FORBIDDEN`. |
| GW-R4 | Remove incoming `X-User-Id`, `X-User-Role`, `X-User-Name`, `X-Patient-Id`, `X-Doctor-Id`; then set them from the token. |
| GW-R5 | If `X-Request-Id` missing → set a new UUID. Return it in the response header too. |
| GW-R6 | Target service down / connection refused / no response in 10 s → 503 `SERVICE_UNAVAILABLE` in the standard error format. |
| GW-R7 | No route matched → 404. |
| GW-R8 | CORS: allow the origins in config `hms.cors.allowed-origins` — admin-web `http://localhost:5173`, clinic-web `http://localhost:3000`, patient-app web build `http://localhost:8090`. Methods GET/POST/PUT/PATCH/DELETE; headers `Authorization`, `Content-Type`. (Flutter Android/iOS builds don't use CORS.) |

## 5. Implementation Notes

- One `GlobalFilter` does GW-R2 to GW-R5. The allowed role is decided with a plain if-chain on the path in the order of section 3.
- Route URIs come from `application.yml` so they can point at `localhost` ports when running outside Docker.
- Errors are written as JSON in the standard format (SVC-00 §7), not the Spring default error page.

## 6. Error Codes

`AUTH_TOKEN_INVALID`, `AUTH_FORBIDDEN`, `SERVICE_UNAVAILABLE`
