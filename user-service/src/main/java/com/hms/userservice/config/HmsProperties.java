package com.hms.userservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hms")
public class HmsProperties {

    private String adminRegistrationCode;
    private String pharmacyRegistrationCode;
    private final Jwt jwt = new Jwt();
    private final Services services = new Services();

    public String getAdminRegistrationCode() {
        return adminRegistrationCode;
    }

    public void setAdminRegistrationCode(String adminRegistrationCode) {
        this.adminRegistrationCode = adminRegistrationCode;
    }

    public String getPharmacyRegistrationCode() {
        return pharmacyRegistrationCode;
    }

    public void setPharmacyRegistrationCode(String pharmacyRegistrationCode) {
        this.pharmacyRegistrationCode = pharmacyRegistrationCode;
    }

    public Jwt getJwt() {
        return jwt;
    }

    public Services getServices() {
        return services;
    }

    public static class Jwt {
        private String secret;
        private long expiryMinutes;

        public String getSecret() {
            return secret;
        }

        public void setSecret(String secret) {
            this.secret = secret;
        }

        public long getExpiryMinutes() {
            return expiryMinutes;
        }

        public void setExpiryMinutes(long expiryMinutes) {
            this.expiryMinutes = expiryMinutes;
        }
    }

    public static class Services {
        private String doctorUrl;

        public String getDoctorUrl() {
            return doctorUrl;
        }

        public void setDoctorUrl(String doctorUrl) {
            this.doctorUrl = doctorUrl;
        }
    }
}
