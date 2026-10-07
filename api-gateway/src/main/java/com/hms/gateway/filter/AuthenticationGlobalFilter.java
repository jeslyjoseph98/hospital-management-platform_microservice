package com.hms.gateway.filter;

import com.hms.gateway.routing.RouteRule;
import com.hms.gateway.routing.RouteTable;
import com.hms.gateway.security.InvalidTokenException;
import com.hms.gateway.security.JwtClaims;
import com.hms.gateway.security.JwtService;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import com.hms.gateway.error.ErrorResponseWriter;

import java.util.Optional;
import java.util.UUID;

/**
 * The single GlobalFilter implementing GW-R1 through GW-R5 and GW-R7 (SVC-01
 * sections 4 and 5):
 * <ul>
 *   <li>GW-R1: requests under {@code /api/v1/auth/**} skip token checks.</li>
 *   <li>GW-R2: every other route requires a valid, non-expired bearer token,
 *       otherwise 401 {@code AUTH_TOKEN_INVALID}.</li>
 *   <li>GW-R3: the token's role must match the role allowed for the matched
 *       route, otherwise 403 {@code AUTH_FORBIDDEN}.</li>
 *   <li>GW-R4: any incoming identity headers are stripped and replaced with
 *       values derived from the verified token.</li>
 *   <li>GW-R5: {@code X-Request-Id} is generated if missing, and always
 *       echoed back on the response.</li>
 *   <li>GW-R7: a path that matches no routing table entry is rejected with
 *       404 before it ever reaches a downstream route (this also covers
 *       {@code /internal/**}, which has no gateway route at all).</li>
 * </ul>
 * Runs before Spring Cloud Gateway's routing filters so that identity
 * headers are in place by the time the request is proxied downstream.
 */
@Component
public class AuthenticationGlobalFilter implements GlobalFilter, Ordered {

    private static final String AUTH_PREFIX = "/api/v1/auth/";
    private static final String BEARER_PREFIX = "Bearer ";

    private final RouteTable routeTable;
    private final JwtService jwtService;

    public AuthenticationGlobalFilter(RouteTable routeTable, JwtService jwtService) {
        this.routeTable = routeTable;
        this.jwtService = jwtService;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getRawPath();

        String requestId = ensureRequestId(exchange);

        // GW-R1: public auth routes skip token checks entirely, but headers
        // are still stripped (defense in depth) and the request id is set.
        if (path.startsWith(AUTH_PREFIX) || path.equals("/api/v1/auth")) {
            ServerHttpRequest mutated = stripIdentityHeaders(request).build();
            return chain.filter(exchange.mutate().request(mutated).build());
        }

        Optional<RouteRule> matched = routeTable.match(path);
        if (matched.isEmpty()) {
            // GW-R7: no route matched (includes /internal/** which the
            // gateway never exposes).
            return ErrorResponseWriter.write(exchange.getResponse(), HttpStatus.NOT_FOUND,
                    "NOT_FOUND", "No such route");
        }

        RouteRule rule = matched.get();

        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX) || authHeader.length() <= BEARER_PREFIX.length()) {
            return unauthorized(exchange);
        }
        String token = authHeader.substring(BEARER_PREFIX.length()).trim();

        JwtClaims claims;
        try {
            claims = jwtService.parse(token);
        } catch (InvalidTokenException e) {
            return unauthorized(exchange);
        }

        // rule.isPublic() cannot happen here (auth routes are handled above)
        // but guard defensively in case the table changes.
        if (!rule.isPublic() && claims.role() != rule.requiredRole()) {
            return ErrorResponseWriter.write(exchange.getResponse(), HttpStatus.FORBIDDEN,
                    "AUTH_FORBIDDEN", "Role " + claims.role() + " is not allowed to access this resource");
        }

        ServerHttpRequest.Builder mutatedRequest = stripIdentityHeaders(request);
        mutatedRequest.header(Headers.X_USER_ID, claims.userId());
        mutatedRequest.header(Headers.X_USER_ROLE, claims.role().name());
        mutatedRequest.header(Headers.X_USER_NAME, claims.name());
        if (claims.patientId() != null) {
            mutatedRequest.header(Headers.X_PATIENT_ID, claims.patientId());
        }
        if (claims.doctorId() != null) {
            mutatedRequest.header(Headers.X_DOCTOR_ID, claims.doctorId());
        }
        mutatedRequest.header(Headers.X_REQUEST_ID, requestId);

        return chain.filter(exchange.mutate().request(mutatedRequest.build()).build());
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        return ErrorResponseWriter.write(exchange.getResponse(), HttpStatus.UNAUTHORIZED,
                "AUTH_TOKEN_INVALID", "Missing, invalid, or expired token");
    }

    /**
     * GW-R5: use the incoming X-Request-Id if present, otherwise generate a
     * new UUID. Sets it on the response immediately so it is present even if
     * the request is rejected (401/403/404).
     */
    private String ensureRequestId(ServerWebExchange exchange) {
        String incoming = exchange.getRequest().getHeaders().getFirst(Headers.X_REQUEST_ID);
        String requestId = (incoming == null || incoming.isBlank()) ? UUID.randomUUID().toString() : incoming;
        exchange.getResponse().getHeaders().set(Headers.X_REQUEST_ID, requestId);
        return requestId;
    }

    /** GW-R4: remove any client-supplied identity headers before re-setting them. */
    private ServerHttpRequest.Builder stripIdentityHeaders(ServerHttpRequest request) {
        ServerHttpRequest.Builder builder = request.mutate();
        for (String header : Headers.CLIENT_SUPPLIED_IDENTITY_HEADERS) {
            builder.headers(httpHeaders -> httpHeaders.remove(header));
        }
        return builder;
    }
}
