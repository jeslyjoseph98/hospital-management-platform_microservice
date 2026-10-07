package com.hms.userservice.controller;

import com.hms.userservice.dto.InternalPatientResponse;
import com.hms.userservice.service.PatientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SVC-02 section 7: GET /internal/patients/{patientId}.
 * Per MS-R5, /internal/** is only reachable service-to-service (the gateway has no route
 * to it); the service itself does not need extra auth here.
 */
@RestController
@RequestMapping("/internal/patients")
public class InternalPatientController {

    private final PatientService patientService;

    public InternalPatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping("/{patientId}")
    public ResponseEntity<InternalPatientResponse> getById(@PathVariable Long patientId) {
        InternalPatientResponse response = patientService.getById(patientId);
        return ResponseEntity.ok(response);
    }
}
