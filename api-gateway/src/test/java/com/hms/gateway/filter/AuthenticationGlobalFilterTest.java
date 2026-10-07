package com.hms.gateway.filter;

import com.hms.gateway.routing.RouteTable;
import com.hms.gateway.security.JwtService;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class AuthenticationGlobalFilterTest {

    private static final String SECRET = "test-secret-key-must-be-at-least-32-bytes-long!!";

    // Pinned to HS256 explicitly, matching what JwtService itself enforces -
    // Keys.hmacShaKeyFor would auto-select HS384 for a key this long.
    private final SecretKey key = new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    private AuthenticationGlobalFilter filter;

    @BeforeEach
    void setUp() {
        filter = new AuthenticationGlobalFilter(new RouteTable(), new JwtService(SECRET));
    }

    private String validPatientToken() {
        return Jwts.builder()
                .subject("42")
                .claim("role", "PATIENT")
                .claim("name", "Jane Doe")
                .claim("patientId", "100")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();
    }

    private String validAdminToken() {
        return Jwts.builder()
                .subject("1")
                .claim("role", "ADMIN")
                .claim("name", "Admin User")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();
    }

    /** A chain that captures the (possibly mutated) exchange passed to it and completes immediately. */
    private static final class CapturingChain implements GatewayFilterChain {
        final AtomicReference<ServerWebExchange> captured = new AtomicReference<>();

        @Override
        public Mono<Void> filter(ServerWebExchange exchange) {
            captured.set(exchange);
            return Mono.empty();
        }
    }

    @Test
    void publicAuthRouteSkipsTokenCheck() {
        MockServerHttpRequest request = MockServerHttpRequest.post("/api/v1/auth/login").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(chain.captured.get()).isNotNull();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void missingTokenReturns401() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(chain.captured.get()).isNull();
    }

    @Test
    void malformedAuthorizationHeaderReturns401() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me")
                .header(HttpHeaders.AUTHORIZATION, "Basic abc123")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void expiredTokenReturns401() {
        String expired = Jwts.builder()
                .subject("42")
                .claim("role", "PATIENT")
                .claim("name", "Jane Doe")
                .claim("patientId", "100")
                .expiration(new Date(System.currentTimeMillis() - 1_000))
                .signWith(key)
                .compact();

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + expired)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void roleMismatchReturns403() {
        // Admin-only route called with a PATIENT token.
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/admin/departments")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validPatientToken())
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(chain.captured.get()).isNull();
    }

    @Test
    void noRouteMatchedReturns404() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/internal/patients/1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validAdminToken())
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void validTokenSetsIdentityHeadersAndForwardsRequest() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validPatientToken())
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        ServerHttpRequest forwarded = chain.captured.get().getRequest();
        assertThat(forwarded.getHeaders().getFirst(Headers.X_USER_ID)).isEqualTo("42");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_USER_ROLE)).isEqualTo("PATIENT");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_USER_NAME)).isEqualTo("Jane Doe");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_PATIENT_ID)).isEqualTo("100");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_DOCTOR_ID)).isNull();
    }

    @Test
    void incomingSpoofedIdentityHeadersAreStrippedAndReplaced() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validPatientToken())
                .header(Headers.X_USER_ID, "999")
                .header(Headers.X_USER_ROLE, "ADMIN")
                .header(Headers.X_USER_NAME, "Spoofed Name")
                .header(Headers.X_PATIENT_ID, "999")
                .header(Headers.X_DOCTOR_ID, "999")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        ServerHttpRequest forwarded = chain.captured.get().getRequest();
        // Re-set from the verified token, not the spoofed incoming values.
        assertThat(forwarded.getHeaders().getFirst(Headers.X_USER_ID)).isEqualTo("42");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_USER_ROLE)).isEqualTo("PATIENT");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_USER_NAME)).isEqualTo("Jane Doe");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_PATIENT_ID)).isEqualTo("100");
        assertThat(forwarded.getHeaders().getFirst(Headers.X_DOCTOR_ID)).isNull();
    }

    @Test
    void missingRequestIdIsGeneratedAndReturnedOnResponse() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validPatientToken())
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        String responseRequestId = exchange.getResponse().getHeaders().getFirst(Headers.X_REQUEST_ID);
        assertThat(responseRequestId).isNotBlank();

        ServerHttpRequest forwarded = chain.captured.get().getRequest();
        assertThat(forwarded.getHeaders().getFirst(Headers.X_REQUEST_ID)).isEqualTo(responseRequestId);
    }

    @Test
    void existingRequestIdIsPreservedAndEchoedBack() {
        String existingId = "client-supplied-id-123";
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/patients/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validPatientToken())
                .header(Headers.X_REQUEST_ID, existingId)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getHeaders().getFirst(Headers.X_REQUEST_ID)).isEqualTo(existingId);
        ServerHttpRequest forwarded = chain.captured.get().getRequest();
        assertThat(forwarded.getHeaders().getFirst(Headers.X_REQUEST_ID)).isEqualTo(existingId);
    }

    @Test
    void adminTokenOnAdminAppointmentsRoutePasses() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/admin/appointments/5")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + validAdminToken())
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        CapturingChain chain = new CapturingChain();

        filter.filter(exchange, chain).block();

        assertThat(chain.captured.get()).isNotNull();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }
}
