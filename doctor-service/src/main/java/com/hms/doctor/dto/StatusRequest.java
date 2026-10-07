package com.hms.doctor.dto;

import jakarta.validation.constraints.NotNull;

public class StatusRequest {

    @NotNull(message = "active is required")
    private Boolean active;

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
