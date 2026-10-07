package com.hms.userservice.dto;

/**
 * The "user" object shape returned by login, /auth/me (SVC-02 section 6.2).
 */
public class UserSummary {
    private Long id;
    private String name;
    private String role;
    private Long patientId;
    private String patientCode;
    private Long doctorId;

    public UserSummary() {
    }

    public UserSummary(Long id, String name, String role, Long patientId, String patientCode, Long doctorId) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.patientId = patientId;
        this.patientCode = patientCode;
        this.doctorId = doctorId;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Long getPatientId() {
        return patientId;
    }

    public void setPatientId(Long patientId) {
        this.patientId = patientId;
    }

    public String getPatientCode() {
        return patientCode;
    }

    public void setPatientCode(String patientCode) {
        this.patientCode = patientCode;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }
}
