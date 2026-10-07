package com.hms.userservice.client;

/**
 * 200 body from doctor-service verify-registration: { doctorId, fullName }.
 */
public class DoctorVerifyResponse {
    private Long doctorId;
    private String fullName;

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}
