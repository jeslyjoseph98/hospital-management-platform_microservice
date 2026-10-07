package com.hms.userservice.security;

import com.hms.userservice.config.HmsProperties;
import com.hms.userservice.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * JWT HS256 issuance and self-validation (LOG-R6, and /auth/me which validates its own token
 * because /auth/** is public at the gateway).
 */
@Service
public class JwtService {

    private final HmsProperties hmsProperties;

    public JwtService(HmsProperties hmsProperties) {
        this.hmsProperties = hmsProperties;
    }

    private SecretKey signingKey() {
        byte[] keyBytes = hmsProperties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(normalizeKey(keyBytes));
    }

    /**
     * HS256 requires a key of at least 256 bits (32 bytes). Pad short dev secrets
     * deterministically so local/dev configs with short secrets don't crash at runtime.
     */
    private byte[] normalizeKey(byte[] keyBytes) {
        if (keyBytes.length >= 32) {
            return keyBytes;
        }
        byte[] padded = new byte[32];
        for (int i = 0; i < 32; i++) {
            padded[i] = keyBytes[i % keyBytes.length];
        }
        return padded;
    }

    public long expirySeconds() {
        return hmsProperties.getJwt().getExpiryMinutes() * 60;
    }

    public String issueToken(User user, Long patientId, String patientCode) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expirySeconds());

        var builder = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("role", user.getRole())
                .claim("name", user.getFullName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp));

        if ("PATIENT".equals(user.getRole())) {
            builder.claim("patientId", patientId);
            builder.claim("patientCode", patientCode);
        }
        if ("DOCTOR".equals(user.getRole())) {
            builder.claim("doctorId", user.getDoctorId());
        }

        return builder.signWith(signingKey()).compact();
    }

    /**
     * Validates and parses a bearer token. Returns the claims, or throws JwtException
     * (caught by the caller and mapped to 401 AUTH_TOKEN_INVALID).
     */
    public Claims parseAndValidate(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public static class InvalidTokenException extends JwtException {
        public InvalidTokenException(String message) {
            super(message);
        }
    }
}
