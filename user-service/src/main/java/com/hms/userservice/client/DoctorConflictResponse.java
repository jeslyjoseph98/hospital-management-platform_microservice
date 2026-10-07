package com.hms.userservice.client;

/**
 * 409 body from doctor-service verify-registration: { "reason": "PHONE_MISMATCH" | "INACTIVE" }.
 */
public class DoctorConflictResponse {
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
