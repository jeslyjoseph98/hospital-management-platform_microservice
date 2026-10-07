package com.hms.userservice.controller;

import com.hms.userservice.dto.ApiResponse;
import com.hms.userservice.dto.PatientProfileResponse;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.service.PatientService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SVC-02 section 6.3: GET /api/v1/patients/me.
 * Per MS-R7 / SVC-00 section 6, the gateway has already enforced the PATIENT role and
 * sets X-User-Id for the logged-in user; the patient id itself comes from the DB, not the
 * request, per "Services take patient id ... from these headers, never from the request body."
 */
@RestController
@RequestMapping("/api/v1/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> me(
            @RequestHeader(value = "X-User-Id", required = false) Long userId) {
        if (userId == null) {
            throw new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "Missing X-User-Id header");
        }
        PatientProfileResponse response = patientService.getOwnProfile(userId);
        return ResponseEntity.ok(ApiResponse.ok(response, null));
    }
}
