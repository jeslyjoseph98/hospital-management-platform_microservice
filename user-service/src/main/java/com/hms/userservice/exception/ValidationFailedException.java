package com.hms.userservice.exception;

import com.hms.userservice.dto.FieldError;

import java.util.List;

/**
 * 400 VALIDATION_FAILED with a list of fieldErrors, per SVC-00 section 7.
 */
public class ValidationFailedException extends RuntimeException {

    private final List<FieldError> fieldErrors;

    public ValidationFailedException(List<FieldError> fieldErrors) {
        super("Validation failed");
        this.fieldErrors = fieldErrors;
    }

    public List<FieldError> getFieldErrors() {
        return fieldErrors;
    }
}
