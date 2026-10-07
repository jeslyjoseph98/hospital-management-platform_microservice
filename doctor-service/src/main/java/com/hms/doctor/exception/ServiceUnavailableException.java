package com.hms.doctor.exception;

import org.springframework.http.HttpStatus;

/** Raised when a dependent sync call (e.g. appointment-service) is down, times out, or returns 5xx. */
public class ServiceUnavailableException extends BusinessException {
    public ServiceUnavailableException(String message) {
        super("SERVICE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE, message);
    }
}
