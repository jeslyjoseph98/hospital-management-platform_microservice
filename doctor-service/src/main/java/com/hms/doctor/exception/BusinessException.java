package com.hms.doctor.exception;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;
    private final Object data;

    public BusinessException(String errorCode, HttpStatus status, String message) {
        this(errorCode, status, message, null);
    }

    public BusinessException(String errorCode, HttpStatus status, String message, Object data) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
        this.data = data;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public Object getData() {
        return data;
    }
}
