package com.hms.gateway.error;

/**
 * One entry of the {@code fieldErrors} array in the standard error envelope
 * (SVC-00 section 7). The gateway never actually populates this (it does no
 * field validation) but the shape is part of the contract.
 */
public record FieldError(String field, String message) {
}
