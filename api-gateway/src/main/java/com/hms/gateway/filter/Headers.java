package com.hms.gateway.filter;

/**
 * Header names the gateway controls (SVC-00 section 6).
 */
public final class Headers {

    public static final String X_USER_ID = "X-User-Id";
    public static final String X_USER_ROLE = "X-User-Role";
    public static final String X_USER_NAME = "X-User-Name";
    public static final String X_PATIENT_ID = "X-Patient-Id";
    public static final String X_DOCTOR_ID = "X-Doctor-Id";
    public static final String X_REQUEST_ID = "X-Request-Id";

    /** Incoming headers that must never be trusted from the client (GW-R4). */
    public static final String[] CLIENT_SUPPLIED_IDENTITY_HEADERS = {
            X_USER_ID, X_USER_ROLE, X_USER_NAME, X_PATIENT_ID, X_DOCTOR_ID
    };

    private Headers() {
    }
}
