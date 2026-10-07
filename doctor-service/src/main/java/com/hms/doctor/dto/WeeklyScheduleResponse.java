package com.hms.doctor.dto;

import java.util.List;

public class WeeklyScheduleResponse {
    private Long doctorId;
    private String fullName;
    private String departmentName;
    private boolean active;
    private Integer dailyLimit;
    private List<AdminTimingView> timings;

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

    public String getDepartmentName() {
        return departmentName;
    }

    public void setDepartmentName(String departmentName) {
        this.departmentName = departmentName;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Integer getDailyLimit() {
        return dailyLimit;
    }

    public void setDailyLimit(Integer dailyLimit) {
        this.dailyLimit = dailyLimit;
    }

    public List<AdminTimingView> getTimings() {
        return timings;
    }

    public void setTimings(List<AdminTimingView> timings) {
        this.timings = timings;
    }
}
