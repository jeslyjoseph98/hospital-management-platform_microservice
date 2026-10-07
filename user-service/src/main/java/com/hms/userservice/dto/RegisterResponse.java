package com.hms.userservice.dto;

public class RegisterResponse {
    private Long userId;
    private String role;
    private String patientCode;

    public RegisterResponse() {
    }

    public RegisterResponse(Long userId, String role, String patientCode) {
        this.userId = userId;
        this.role = role;
        this.patientCode = patientCode;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getPatientCode() {
        return patientCode;
    }

    public void setPatientCode(String patientCode) {
        this.patientCode = patientCode;
    }
}
