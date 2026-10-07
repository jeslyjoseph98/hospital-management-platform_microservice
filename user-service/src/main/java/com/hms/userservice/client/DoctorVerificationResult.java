package com.hms.userservice.client;

/**
 * Outcome of calling doctor-service GET /internal/doctors/verify-registration (REG-R11).
 */
public class DoctorVerificationResult {

    public enum Status {
        FOUND,
        NOT_FOUND,
        PHONE_MISMATCH,
        INACTIVE
    }

    private final Status status;
    private final Long doctorId;
    private final String fullName;

    private DoctorVerificationResult(Status status, Long doctorId, String fullName) {
        this.status = status;
        this.doctorId = doctorId;
        this.fullName = fullName;
    }

    public static DoctorVerificationResult found(Long doctorId, String fullName) {
        return new DoctorVerificationResult(Status.FOUND, doctorId, fullName);
    }

    public static DoctorVerificationResult of(Status status) {
        return new DoctorVerificationResult(status, null, null);
    }

    public Status getStatus() {
        return status;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public String getFullName() {
        return fullName;
    }
}
