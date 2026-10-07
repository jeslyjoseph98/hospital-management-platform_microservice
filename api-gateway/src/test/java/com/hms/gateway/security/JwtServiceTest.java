package com.hms.gateway.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-must-be-at-least-32-bytes-long!!";

    private final JwtService jwtService = new JwtService(SECRET);
    // Pinned to HS256 explicitly, matching what JwtService itself enforces -
    // Keys.hmacShaKeyFor would auto-select HS384 for a key this long.
    private final SecretKey key = new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");

    private String token(String subject, String role, String name, String patientId, String doctorId, long expiresInMillis) {
        var builder = Jwts.builder()
                .subject(subject)
                .claim("role", role)
                .claim("name", name)
                .expiration(new Date(System.currentTimeMillis() + expiresInMillis))
                .signWith(key);
        if (patientId != null) {
            builder.claim("patientId", patientId);
        }
        if (doctorId != null) {
            builder.claim("doctorId", doctorId);
        }
        return builder.compact();
    }

    @Test
    void parsesValidPatientToken() {
        String token = token("42", "PATIENT", "Jane Doe", "100", null, 60_000);

        JwtClaims claims = jwtService.parse(token);

        assertThat(claims.userId()).isEqualTo("42");
        assertThat(claims.role()).isEqualTo(Role.PATIENT);
        assertThat(claims.name()).isEqualTo("Jane Doe");
        assertThat(claims.patientId()).isEqualTo("100");
        assertThat(claims.doctorId()).isNull();
    }

    @Test
    void parsesValidDoctorToken() {
        String token = token("7", "DOCTOR", "Dr. Rahul Menon", null, "55", 60_000);

        JwtClaims claims = jwtService.parse(token);

        assertThat(claims.role()).isEqualTo(Role.DOCTOR);
        assertThat(claims.doctorId()).isEqualTo("55");
    }

    @Test
    void parsesValidAdminToken_noPatientOrDoctorIdRequired() {
        String token = token("1", "ADMIN", "Admin User", null, null, 60_000);

        JwtClaims claims = jwtService.parse(token);

        assertThat(claims.role()).isEqualTo(Role.ADMIN);
        assertThat(claims.patientId()).isNull();
        assertThat(claims.doctorId()).isNull();
    }

    @Test
    void rejectsExpiredToken() {
        String token = token("42", "PATIENT", "Jane Doe", "100", null, -1_000);

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsBadSignature() {
        SecretKey otherKey = Keys.hmacShaKeyFor("a-completely-different-secret-key-32-bytes!".getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject("42")
                .claim("role", "PATIENT")
                .claim("name", "Jane Doe")
                .claim("patientId", "100")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(otherKey)
                .compact();

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsMalformedToken() {
        assertThatThrownBy(() -> jwtService.parse("not-a-real-jwt"))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsPatientTokenMissingPatientId() {
        String token = token("42", "PATIENT", "Jane Doe", null, null, 60_000);

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("patientId");
    }

    @Test
    void rejectsDoctorTokenMissingDoctorId() {
        String token = token("7", "DOCTOR", "Dr. Rahul Menon", null, null, 60_000);

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("doctorId");
    }

    @Test
    void rejectsTokenSignedWithStrongerAlgorithmThanHs256() {
        // A key of this length lets jjwt's Keys.hmacShaKeyFor auto-select
        // HS384; SVC-01 requires HS256 specifically, so such a token must be
        // rejected even though the signature itself is valid for that key.
        SecretKey hs384Key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject("42")
                .claim("role", "PATIENT")
                .claim("name", "Jane Doe")
                .claim("patientId", "100")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(hs384Key)
                .compact();

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsUnknownRole() {
        String token = Jwts.builder()
                .subject("1")
                .claim("role", "SUPERUSER")
                .claim("name", "Someone")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(InvalidTokenException.class);
    }
}
