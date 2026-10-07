# api-gateway

Single public entry point for the HMS platform (SVC-01). Spring Cloud Gateway
(WebFlux), Java, Maven. No database, no business logic: it validates the JWT,
enforces per-route roles, injects trusted `X-User-*` headers, and proxies to
the right backend service.

## Run locally

Requires JDK 17 and Maven.

```bash
mvn spring-boot:run
```

The gateway listens on port 8080 by default. It will route to
`localhost:8081..8085` by default (see `application.yml`), which is useful
when running the other services directly on the host instead of in Docker.

## Test

```bash
mvn test
```

Runs JWT validation unit tests, route-table matching tests, filter
(auth/role/header/request-id) tests, and a full Spring context load test.

Build only (no tests):

```bash
mvn -DskipTests compile
```

## Docker

```bash
docker build -t hms/api-gateway .
docker run -p 8080:8080 \
  -e HMS_JWT_SECRET=... \
  -e HMS_SERVICES_USER_URL=http://user-service:8081 \
  -e HMS_SERVICES_DOCTOR_URL=http://doctor-service:8082 \
  -e HMS_SERVICES_APPOINTMENT_URL=http://appointment-service:8083 \
  -e HMS_SERVICES_CONSULTATION_URL=http://consultation-service:8084 \
  -e HMS_SERVICES_NOTIFICATION_URL=http://notification-service:8085 \
  -e HMS_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8090 \
  hms/api-gateway
```

In the platform's `docker-compose.yml`, all of this is already wired up for
the `api-gateway` service.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `SERVER_PORT` | HTTP port the gateway listens on | `8080` |
| `HMS_JWT_SECRET` | HS256 signing secret (must match user-service) | `dev-only-change-me-dev-only-change-me` |
| `HMS_SERVICES_USER_URL` | Base URL for user-service (auth, patients/me) | `http://localhost:8081` |
| `HMS_SERVICES_DOCTOR_URL` | Base URL for doctor-service (departments, doctors, admin) | `http://localhost:8082` |
| `HMS_SERVICES_APPOINTMENT_URL` | Base URL for appointment-service | `http://localhost:8083` |
| `HMS_SERVICES_CONSULTATION_URL` | Base URL for consultation-service | `http://localhost:8084` |
| `HMS_SERVICES_NOTIFICATION_URL` | Base URL for notification-service | `http://localhost:8085` |
| `HMS_CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173,http://localhost:3000,http://localhost:8090` |

## What it does (SVC-01)

- Validates the HS256 JWT (secret from `HMS_JWT_SECRET`) on every route
  except `/api/v1/auth/**`; missing/invalid/expired token -> 401
  `AUTH_TOKEN_INVALID`.
- Checks the token's `role` claim against the role allowed for the matched
  path (see the routing table in the spec); mismatch -> 403 `AUTH_FORBIDDEN`.
- Strips any client-supplied `X-User-Id` / `X-User-Role` / `X-User-Name` /
  `X-Patient-Id` / `X-Doctor-Id` headers and re-sets them from the verified
  token claims, so downstream services can trust them unconditionally.
- Generates `X-Request-Id` when absent and echoes it back on the response;
  otherwise passes through the client-supplied value.
- Routes to the correct downstream service per the routing table; a path
  that matches no route (including anything under `/internal/**`, which the
  gateway never exposes) -> 404.
- A downstream that is down, refuses the connection, or doesn't respond
  within 10 seconds -> 503 `SERVICE_UNAVAILABLE`.
- CORS for the configured frontend origins (`HMS_CORS_ALLOWED_ORIGINS`):
  GET/POST/PUT/PATCH/DELETE with `Authorization`/`Content-Type` headers.
- All errors (401/403/404/503/500) are written as JSON in the platform's
  standard envelope (`success`, `errorCode`, `message`, `fieldErrors`,
  `data`), never Spring's default error page.

## Project layout

```
src/main/java/com/hms/gateway/
 ├── GatewayApplication.java      Spring Boot entry point
 ├── filter/                      AuthenticationGlobalFilter (GW-R1..GW-R5, GW-R7) + header constants
 ├── routing/                     RouteTable / RouteRule: path -> required role (SVC-01 §3)
 ├── security/                    JwtService (HS256 validation), JwtClaims, Role, InvalidTokenException
 ├── error/                       Standard error envelope (ApiErrorResponse) + writer
 ├── exception/                   Global reactive error handler (404/503/500 as the standard envelope)
 └── config/                      CorsConfig (GW-R8)
src/main/resources/application.yml   Gateway routes, timeouts, env var bindings
```
