package com.hms.doctor.controller;

import com.hms.doctor.exception.BusinessException;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * SVC-03 section 5: /internal/doctors/verify-registration returns a bare
 * { "reason": "PHONE_MISMATCH" | "INACTIVE" } body on 409, and a bare 404 (no body wrapper) when not found -
 * this does not follow the standard ApiResponse envelope used by public /api/v1/** endpoints.
 */
@RestControllerAdvice(assignableTypes = InternalDoctorController.class)
@Order(0)
public class InternalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<?> handleBusiness(BusinessException ex) {
        if (ex.getStatus() == HttpStatus.NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (ex.getStatus() == HttpStatus.CONFLICT) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("reason", ex.getErrorCode()));
        }
        return ResponseEntity.status(ex.getStatus()).body(Map.of("errorCode", ex.getErrorCode(), "message", ex.getMessage()));
    }
}
