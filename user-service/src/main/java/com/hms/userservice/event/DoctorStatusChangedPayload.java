package com.hms.userservice.event;

/**
 * Payload consumed from topic doctor.status-changed (SVC-02 section 9).
 */
public class DoctorStatusChangedPayload {
    private Long doctorId;
    private boolean active;

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
