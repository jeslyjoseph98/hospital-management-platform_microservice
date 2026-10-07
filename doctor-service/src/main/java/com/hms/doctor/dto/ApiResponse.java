package com.hms.doctor.dto;

import java.util.Collections;
import java.util.List;

public class ApiResponse<T> {
    private boolean success;
    private String errorCode;
    private String message;
    private List<FieldError> fieldErrors;
    private T data;

    public static <T> ApiResponse<T> ok(T data, String message) {
        ApiResponse<T> r = new ApiResponse<>();
        r.success = true;
        r.data = data;
        r.message = message;
        r.fieldErrors = Collections.emptyList();
        return r;
    }

    public static <T> ApiResponse<T> error(String errorCode, String message, List<FieldError> fieldErrors, T data) {
        ApiResponse<T> r = new ApiResponse<>();
        r.success = false;
        r.errorCode = errorCode;
        r.message = message;
        r.fieldErrors = fieldErrors == null ? Collections.emptyList() : fieldErrors;
        r.data = data;
        return r;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<FieldError> getFieldErrors() {
        return fieldErrors;
    }

    public void setFieldErrors(List<FieldError> fieldErrors) {
        this.fieldErrors = fieldErrors;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public static class FieldError {
        private String field;
        private String message;

        public FieldError() {
        }

        public FieldError(String field, String message) {
            this.field = field;
            this.message = message;
        }

        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}
