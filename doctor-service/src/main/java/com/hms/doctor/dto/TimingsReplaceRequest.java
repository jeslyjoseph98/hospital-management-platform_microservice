package com.hms.doctor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class TimingsReplaceRequest {

    @NotNull(message = "timings is required")
    @Valid
    private List<TimingRequest> timings;

    public List<TimingRequest> getTimings() {
        return timings;
    }

    public void setTimings(List<TimingRequest> timings) {
        this.timings = timings;
    }
}
