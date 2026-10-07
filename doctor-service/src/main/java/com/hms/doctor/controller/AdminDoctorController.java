package com.hms.doctor.controller;

import com.hms.doctor.dto.*;
import com.hms.doctor.model.Doctor;
import com.hms.doctor.service.DoctorAvailabilityService;
import com.hms.doctor.service.DoctorService;
import com.hms.doctor.util.HeaderUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/doctors")
public class AdminDoctorController {

    private final DoctorService doctorService;
    private final DoctorAvailabilityService availabilityService;

    public AdminDoctorController(DoctorService doctorService, DoctorAvailabilityService availabilityService) {
        this.doctorService = doctorService;
        this.availabilityService = availabilityService;
    }

    @GetMapping
    public ApiResponse<PagedResponse<AdminDoctorResponse>> search(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(doctorService.search(departmentId, name, active, page, size), null);
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminDoctorResponse> getDetail(@PathVariable Long id) {
        return ApiResponse.ok(doctorService.getAdminDetail(id), null);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminDoctorResponse>> create(@Valid @RequestBody DoctorRequest request,
                                                                     HttpServletRequest httpRequest) {
        Doctor doctor = doctorService.create(request, HeaderUtil.userId(httpRequest));
        AdminDoctorResponse response = doctorService.getAdminDetail(doctor.getId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(response, "Doctor added successfully"));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminDoctorResponse> update(@PathVariable Long id,
                                                    @Valid @RequestBody DoctorRequest request,
                                                    HttpServletRequest httpRequest) {
        doctorService.update(id, request, HeaderUtil.userId(httpRequest));
        return ApiResponse.ok(doctorService.getAdminDetail(id), "Doctor updated successfully");
    }

    @PutMapping("/{id}/timings")
    public ApiResponse<List<AdminTimingView>> replaceTimings(@PathVariable Long id,
                                                              @Valid @RequestBody TimingsReplaceRequest request) {
        List<AdminTimingView> timings = availabilityService.replace(id, request.getTimings());
        return ApiResponse.ok(timings, "Weekly timings updated successfully");
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<AdminDoctorResponse> updateStatus(@PathVariable Long id,
                                                          @Valid @RequestBody StatusRequest request,
                                                          HttpServletRequest httpRequest) {
        doctorService.updateStatus(id, request.getActive(), HeaderUtil.userId(httpRequest));
        return ApiResponse.ok(doctorService.getAdminDetail(id), "Doctor status updated successfully");
    }
}
