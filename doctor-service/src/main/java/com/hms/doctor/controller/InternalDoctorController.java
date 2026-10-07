package com.hms.doctor.controller;

import com.hms.doctor.dto.VerifyRegistrationResponse;
import com.hms.doctor.dto.WeeklyScheduleResponse;
import com.hms.doctor.service.InternalDoctorService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * MS-R5: /internal/** endpoints are only for service-to-service calls.
 * The gateway has no route to them; these return raw objects (no ApiResponse envelope),
 * matching the plain JSON shapes shown in SVC-03 section 5.
 */
@RestController
@RequestMapping("/internal/doctors")
public class InternalDoctorController {

    private final InternalDoctorService internalDoctorService;

    public InternalDoctorController(InternalDoctorService internalDoctorService) {
        this.internalDoctorService = internalDoctorService;
    }

    @GetMapping("/verify-registration")
    public VerifyRegistrationResponse verifyRegistration(@RequestParam String registrationNumber,
                                                           @RequestParam String phone) {
        return internalDoctorService.verifyRegistration(registrationNumber, phone);
    }

    @GetMapping("/{id}/weekly-schedule")
    public WeeklyScheduleResponse weeklySchedule(@PathVariable Long id) {
        return internalDoctorService.getWeeklySchedule(id);
    }
}
