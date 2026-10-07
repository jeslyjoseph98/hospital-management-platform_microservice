package com.hms.doctor.dto;

public class DepartmentResponse {
    private Long id;
    private String deptName;
    private String description;
    private boolean active;
    private Long activeDoctorCount;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDeptName() {
        return deptName;
    }

    public void setDeptName(String deptName) {
        this.deptName = deptName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Long getActiveDoctorCount() {
        return activeDoctorCount;
    }

    public void setActiveDoctorCount(Long activeDoctorCount) {
        this.activeDoctorCount = activeDoctorCount;
    }
}
