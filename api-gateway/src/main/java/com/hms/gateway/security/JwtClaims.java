package com.hms.gateway.security;

/**
 * Verified claims extracted from an incoming JWT, used by the gateway to set
 * the X-User-* / X-Patient-Id / X-Doctor-Id headers (SVC-00 section 6).
 *
 * @param userId    the token subject ({@code sub})
 * @param role      the caller's role ({@code role})
 * @param name      the caller's full name ({@code name})
 * @param patientId present only when role is PATIENT
 * @param doctorId  present only when role is DOCTOR
 */
public record JwtClaims(
        String userId,
        Role role,
        String name,
        String patientId,
        String doctorId
) {
}
