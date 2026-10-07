package com.hms.doctor.dto;

import java.math.BigDecimal;
import java.util.List;

/** Patient-facing doctor view. Never includes registrationNumber, phone, email, loginRegistered (DOC-R16). */
public class PatientDoctorResponse {
    private Long id;
    private String fullName;
    private String qualification;
    private String specialization;
    private Integer experienceYears;
    private BigDecimal consultationFee;
    private String about;
    private List<TimingView> timings;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getQualification() {
        return qualification;
    }

    public void setQualification(String qualification) {
        this.qualification = qualification;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public BigDecimal getConsultationFee() {
        return consultationFee;
    }

    public void setConsultationFee(BigDecimal consultationFee) {
        this.consultationFee = consultationFee;
    }

    public String getAbout() {
        return about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

    public List<TimingView> getTimings() {
        return timings;
    }

    public void setTimings(List<TimingView> timings) {
        this.timings = timings;
    }
}
