package com.hms.doctor.dto;

public class VerifyRegistrationResponse {
    private Long doctorId;
    private String fullName;

    public VerifyRegistrationResponse() {
    }

    public VerifyRegistrationResponse(Long doctorId, String fullName) {
        this.doctorId = doctorId;
        this.fullName = fullName;
    }

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
