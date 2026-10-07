package com.hms.userservice.exception;

import org.springframework.http.HttpStatus;

/**
 * Business rule failure: carries an errorCode and the HTTP status to respond with,
 * per SVC-00 section 7.
 */
public class BusinessException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    public BusinessException(String errorCode, HttpStatus status, String message) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
