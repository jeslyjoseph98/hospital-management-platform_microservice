package com.hms.doctor.controller;

import com.hms.doctor.dto.ApiResponse;
import com.hms.doctor.dto.DepartmentRequest;
import com.hms.doctor.dto.DepartmentResponse;
import com.hms.doctor.dto.StatusRequest;
import com.hms.doctor.model.Department;
import com.hms.doctor.service.DepartmentService;
import com.hms.doctor.util.HeaderUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/departments")
public class AdminDepartmentController {

    private final DepartmentService departmentService;

    public AdminDepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public ApiResponse<List<DepartmentResponse>> listAll() {
        return ApiResponse.ok(departmentService.listAllForAdmin(), null);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DepartmentResponse>> create(@Valid @RequestBody DepartmentRequest request,
                                                                    HttpServletRequest httpRequest) {
        Department department = departmentService.create(request, HeaderUtil.userId(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(toResponse(department), "Department added successfully"));
    }

    @PutMapping("/{id}")
    public ApiResponse<DepartmentResponse> update(@PathVariable Long id,
                                                   @Valid @RequestBody DepartmentRequest request,
                                                   HttpServletRequest httpRequest) {
        Department department = departmentService.update(id, request, HeaderUtil.userId(httpRequest));
        return ApiResponse.ok(toResponse(department), "Department updated successfully");
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<DepartmentResponse> updateStatus(@PathVariable Long id,
                                                         @Valid @RequestBody StatusRequest request,
                                                         HttpServletRequest httpRequest) {
        Department department = departmentService.updateStatus(id, request.getActive(), HeaderUtil.userId(httpRequest));
        return ApiResponse.ok(toResponse(department), "Department status updated successfully");
    }

    private DepartmentResponse toResponse(Department d) {
        DepartmentResponse r = new DepartmentResponse();
        r.setId(d.getId());
        r.setDeptName(d.getDeptName());
        r.setDescription(d.getDescription());
        r.setActive(d.isActive());
        return r;
    }
}
