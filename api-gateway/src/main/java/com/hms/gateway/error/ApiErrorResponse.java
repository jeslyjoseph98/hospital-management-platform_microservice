package com.hms.gateway.error;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * The standard API error envelope defined in SVC-00 section 7:
 * {@code { "success": false, "errorCode": "...", "message": "...",
 * "fieldErrors": [], "data": null } }.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ApiErrorResponse(
        boolean success,
        String errorCode,
        String message,
        List<FieldError> fieldErrors,
        Object data
) {

    public static ApiErrorResponse of(String errorCode, String message) {
        return new ApiErrorResponse(false, errorCode, message, List.of(), null);
    }
}
