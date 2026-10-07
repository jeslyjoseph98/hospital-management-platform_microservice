package com.hms.userservice.dto;

import java.time.LocalDate;

/**
 * Single registration request shape covering all 4 roles (SVC-02 section 4.1).
 * Fields not applicable to the chosen role are ignored if sent.
 * Field-level @NotBlank/@NotNull annotations are intentionally omitted here —
 * role-conditional requiredness is validated in the service layer (REG-R2 etc.)
 * so that we can return precise fieldErrors per rule.
 */
public class RegisterRequest {

    private String role;
    private String fullName;
    private String phone;
    private String email;
    private String password;

    // PATIENT
    private LocalDate dateOfBirth;
    private String gender;
    private String address;

    // DOCTOR
    private String registrationNumber;

    // PHARMACIST
    private String staffCode;

    // ADMIN
    private String adminCode;

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getRegistrationNumber() {
        return registrationNumber;
    }

    public void setRegistrationNumber(String registrationNumber) {
        this.registrationNumber = registrationNumber;
    }

    public String getStaffCode() {
        return staffCode;
    }

    public void setStaffCode(String staffCode) {
        this.staffCode = staffCode;
    }

    public String getAdminCode() {
        return adminCode;
    }

    public void setAdminCode(String adminCode) {
        this.adminCode = adminCode;
    }
}
