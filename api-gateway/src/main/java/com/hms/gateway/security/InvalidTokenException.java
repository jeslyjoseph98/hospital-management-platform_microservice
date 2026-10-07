package com.hms.gateway.security;

/**
 * Thrown whenever a bearer token is missing, malformed, has a bad signature,
 * is expired, or is missing a required claim for its role. Always maps to
 * 401 {@code AUTH_TOKEN_INVALID} (GW-R2).
 */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException(String message) {
        super(message);
    }

    public InvalidTokenException(String message, Throwable cause) {
        super(message, cause);
    }
}
