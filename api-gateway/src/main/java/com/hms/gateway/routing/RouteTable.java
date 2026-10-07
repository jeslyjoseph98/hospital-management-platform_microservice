package com.hms.gateway.routing;

import com.hms.gateway.security.Role;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

import java.util.List;
import java.util.Optional;

/**
 * The ordered routing table from SVC-01 section 3. Matched top to bottom;
 * specific paths come first. Used by the global auth filter to decide which
 * role (if any) is allowed to call a given path. Routing to the actual
 * upstream service is handled separately by Spring Cloud Gateway's route
 * definitions in application.yml — this class only governs auth/role checks,
 * and whether a path is recognized at all (GW-R7: no match -> 404).
 */
@Component
public class RouteTable {

    private final AntPathMatcher matcher = new AntPathMatcher();

    private final List<RouteRule> rules = List.of(
            new RouteRule("/api/v1/auth/**", null),
            new RouteRule("/api/v1/patients/me", Role.PATIENT),
            new RouteRule("/api/v1/doctors/*/availability", Role.PATIENT),
            new RouteRule("/api/v1/departments/**", Role.PATIENT),
            new RouteRule("/api/v1/doctors/**", Role.PATIENT),
            new RouteRule("/api/v1/appointments/**", Role.PATIENT),
            new RouteRule("/api/v1/consultations/my/**", Role.PATIENT),
            new RouteRule("/api/v1/notifications/**", Role.PATIENT),
            new RouteRule("/api/v1/admin/appointments/**", Role.ADMIN),
            new RouteRule("/api/v1/admin/**", Role.ADMIN),
            new RouteRule("/api/v1/doctor/appointments/**", Role.DOCTOR),
            new RouteRule("/api/v1/doctor/**", Role.DOCTOR),
            new RouteRule("/api/v1/pharmacy/**", Role.PHARMACIST)
    );

    /**
     * Finds the first matching rule for the given request path, in table
     * order. Empty if nothing matches (caller should respond 404).
     */
    public Optional<RouteRule> match(String path) {
        return rules.stream()
                .filter(rule -> matcher.match(rule.pathPattern(), path))
                .findFirst();
    }
}
