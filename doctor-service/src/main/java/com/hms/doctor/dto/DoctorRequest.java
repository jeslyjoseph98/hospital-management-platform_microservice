package com.hms.doctor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public class DoctorRequest {

    @NotNull(message = "departmentId is required")
    private Long departmentId;

    @NotBlank(message = "fullName is required")
    private String fullName;

    @NotBlank(message = "qualification is required")
    private String qualification;

    @NotBlank(message = "specialization is required")
    private String specialization;

    @NotBlank(message = "registrationNumber is required")
    private String registrationNumber;

    private Integer experienceYears;

    @NotBlank(message = "phone is required")
    private String phone;

    private String email;

    private String about;

    @NotNull(message = "consultationFee is required")
    private BigDecimal consultationFee;

    private Integer dailyLimit;

    @Valid
    private List<TimingRequest> timings;

    public Long getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(Long departmentId) {
        this.departmentId = departmentId;
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

    public String getRegistrationNumber() {
        return registrationNumber;
    }

    public void setRegistrationNumber(String registrationNumber) {
        this.registrationNumber = registrationNumber;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAbout() {
        return about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

    public BigDecimal getConsultationFee() {
        return consultationFee;
    }

    public void setConsultationFee(BigDecimal consultationFee) {
        this.consultationFee = consultationFee;
    }

    public Integer getDailyLimit() {
        return dailyLimit;
    }

    public void setDailyLimit(Integer dailyLimit) {
        this.dailyLimit = dailyLimit;
    }

    public List<TimingRequest> getTimings() {
        return timings;
    }

    public void setTimings(List<TimingRequest> timings) {
        this.timings = timings;
    }
}
