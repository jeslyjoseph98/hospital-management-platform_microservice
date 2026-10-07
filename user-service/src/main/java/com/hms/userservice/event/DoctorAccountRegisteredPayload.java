package com.hms.userservice.event;

/**
 * Payload for topic user.doctor-account-registered (SVC-02 section 9).
 */
public class DoctorAccountRegisteredPayload {
    private Long userId;
    private Long doctorId;

    public DoctorAccountRegisteredPayload() {
    }

    public DoctorAccountRegisteredPayload(Long userId, Long doctorId) {
        this.userId = userId;
        this.doctorId = doctorId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }
}
