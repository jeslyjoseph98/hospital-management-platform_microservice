package com.hms.doctor.event;

public class DoctorStatusChangedPayload {
    private Long doctorId;
    private boolean active;

    public DoctorStatusChangedPayload() {
    }

    public DoctorStatusChangedPayload(Long doctorId, boolean active) {
        this.doctorId = doctorId;
        this.active = active;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
