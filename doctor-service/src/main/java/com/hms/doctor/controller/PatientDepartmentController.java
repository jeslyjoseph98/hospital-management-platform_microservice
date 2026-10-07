package com.hms.doctor.controller;

import com.hms.doctor.dto.ApiResponse;
import com.hms.doctor.dto.DepartmentResponse;
import com.hms.doctor.dto.PatientDoctorResponse;
import com.hms.doctor.service.DepartmentService;
import com.hms.doctor.service.DoctorService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/departments")
public class PatientDepartmentController {

    private final DepartmentService departmentService;
    private final DoctorService doctorService;

    public PatientDepartmentController(DepartmentService departmentService, DoctorService doctorService) {
        this.departmentService = departmentService;
        this.doctorService = doctorService;
    }

    @GetMapping
    public ApiResponse<List<DepartmentResponse>> listActiveDepartments() {
        return ApiResponse.ok(departmentService.listActiveForPatients(), null);
    }

    @GetMapping("/{id}/doctors")
    public ApiResponse<List<PatientDoctorResponse>> listDoctorsInDepartment(@PathVariable Long id) {
        return ApiResponse.ok(doctorService.listActiveByDepartment(id), null);
    }
}
