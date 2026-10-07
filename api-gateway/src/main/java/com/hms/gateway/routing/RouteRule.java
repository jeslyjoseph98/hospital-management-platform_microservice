package com.hms.gateway.routing;

import com.hms.gateway.security.Role;

/**
 * One row of the routing table in SVC-01 section 3: a path pattern, the role
 * allowed to call it (null = public, no auth required), and nothing else —
 * the actual upstream URI is resolved by Spring Cloud Gateway's own route
 * definitions (see application.yml); this rule only decides the auth/role
 * check performed by the global filter.
 */
public record RouteRule(String pathPattern, Role requiredRole) {

    public boolean isPublic() {
        return requiredRole == null;
    }
}
