package com.hms.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Validates HS256 JWTs and extracts the claims the gateway needs (SVC-01
 * section 2). The secret is the same value configured on user-service, read
 * from env {@code HMS_JWT_SECRET}.
 */
@Component
public class JwtService {

    /** JWS header "alg" value required by SVC-01 section 2. */
    private static final String REQUIRED_ALG = SignatureAlgorithm.HS256.getValue();
    private static final String REQUIRED_ALG_JCA = "HmacSHA256";

    private final SecretKey key;

    public JwtService(@Value("${hms.jwt.secret}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("hms.jwt.secret (HMS_JWT_SECRET) must be configured");
        }
        // Pin the key to HMAC-SHA256 explicitly. Keys.hmacShaKeyFor() would
        // instead pick a stronger HS384/HS512 JCA algorithm based on key
        // length, which (combined with jjwt verifying whatever alg the
        // token header declares) would let non-HS256 tokens be accepted.
        // We also double check the header's declared algorithm below.
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), REQUIRED_ALG_JCA);
    }

    /**
     * Parses and validates the given bearer token, returning its claims.
     *
     * @throws InvalidTokenException if the token is missing, malformed, has
     *                                a bad signature, is expired, declares an
     *                                algorithm other than HS256, or lacks a
     *                                required claim for its role.
     */
    public JwtClaims parse(String token) {
        Claims claims;
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);

            JwsHeader header = jws.getHeader();
            if (!REQUIRED_ALG.equals(header.getAlgorithm())) {
                throw new InvalidTokenException("Unsupported algorithm: " + header.getAlgorithm());
            }
            claims = jws.getPayload();
        } catch (ExpiredJwtException e) {
            throw new InvalidTokenException("Token expired", e);
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("Token invalid", e);
        }

        String subject = claims.getSubject();
        String roleRaw = claims.get("role", String.class);
        String name = claims.get("name", String.class);

        if (subject == null || subject.isBlank()) {
            throw new InvalidTokenException("Missing sub claim");
        }
        if (roleRaw == null || roleRaw.isBlank()) {
            throw new InvalidTokenException("Missing role claim");
        }
        if (name == null || name.isBlank()) {
            throw new InvalidTokenException("Missing name claim");
        }

        Role role;
        try {
            role = Role.valueOf(roleRaw);
        } catch (IllegalArgumentException e) {
            throw new InvalidTokenException("Unknown role claim: " + roleRaw);
        }

        String patientId = claims.get("patientId") != null ? String.valueOf(claims.get("patientId")) : null;
        String doctorId = claims.get("doctorId") != null ? String.valueOf(claims.get("doctorId")) : null;

        if (role == Role.PATIENT && (patientId == null || patientId.isBlank())) {
            throw new InvalidTokenException("Missing patientId claim for PATIENT role");
        }
        if (role == Role.DOCTOR && (doctorId == null || doctorId.isBlank())) {
            throw new InvalidTokenException("Missing doctorId claim for DOCTOR role");
        }

        return new JwtClaims(subject, role, name, patientId, doctorId);
    }
}
