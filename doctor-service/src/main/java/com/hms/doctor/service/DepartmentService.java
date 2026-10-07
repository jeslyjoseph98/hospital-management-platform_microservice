package com.hms.doctor.service;

import com.hms.doctor.dto.DepartmentRequest;
import com.hms.doctor.dto.DepartmentResponse;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DepartmentMapper;
import com.hms.doctor.model.Department;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DepartmentService {

    private final DepartmentMapper departmentMapper;

    public DepartmentService(DepartmentMapper departmentMapper) {
        this.departmentMapper = departmentMapper;
    }

    /** Active departments only (DOC-R14), for patient-facing list. */
    public List<DepartmentResponse> listActiveForPatients() {
        return departmentMapper.findAllActive().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /** All departments with active doctor count, for admin. */
    public List<DepartmentResponse> listAllForAdmin() {
        return departmentMapper.findAll().stream()
                .map(d -> {
                    DepartmentResponse r = toResponse(d);
                    r.setActiveDoctorCount(departmentMapper.countActiveDoctorsByDepartment(d.getId()));
                    return r;
                })
                .collect(Collectors.toList());
    }

    public Department getActiveOrThrow(Long id) {
        Department dept = departmentMapper.findById(id);
        if (dept == null || !dept.isActive()) {
            throw new BusinessException("DOC_DEPARTMENT_NOT_FOUND", HttpStatus.NOT_FOUND, "Department not found");
        }
        return dept;
    }

    public Department getByIdOrThrow(Long id) {
        Department dept = departmentMapper.findById(id);
        if (dept == null) {
            throw new BusinessException("DOC_DEPARTMENT_NOT_FOUND", HttpStatus.NOT_FOUND, "Department not found");
        }
        return dept;
    }

    @Transactional
    public Department create(DepartmentRequest request, Long userId) {
        // DEP-R1: unique ignoring case
        if (departmentMapper.findByNameIgnoreCase(request.getDeptName()) != null) {
            throw new BusinessException("ADM_DEPARTMENT_EXISTS", HttpStatus.CONFLICT,
                    "Department '" + request.getDeptName() + "' already exists");
        }
        Department dept = new Department();
        dept.setDeptName(request.getDeptName());
        dept.setDescription(request.getDescription());
        dept.setActive(true);
        dept.setCreatedBy(userId);
        dept.setUpdatedBy(userId);
        departmentMapper.insert(dept);
        return dept;
    }

    @Transactional
    public Department update(Long id, DepartmentRequest request, Long userId) {
        Department existing = getByIdOrThrow(id);
        Department duplicate = departmentMapper.findByNameIgnoreCaseExcludingId(request.getDeptName(), id);
        if (duplicate != null) {
            throw new BusinessException("ADM_DEPARTMENT_EXISTS", HttpStatus.CONFLICT,
                    "Department '" + request.getDeptName() + "' already exists");
        }
        existing.setDeptName(request.getDeptName());
        existing.setDescription(request.getDescription());
        existing.setUpdatedBy(userId);
        departmentMapper.update(existing);
        return existing;
    }

    @Transactional
    public Department updateStatus(Long id, boolean active, Long userId) {
        Department existing = getByIdOrThrow(id);
        if (!active) {
            // DEP-R2: cannot deactivate with active doctors
            long activeDoctors = departmentMapper.countActiveDoctorsByDepartment(id);
            if (activeDoctors > 0) {
                throw new BusinessException("ADM_DEPARTMENT_HAS_DOCTORS", HttpStatus.CONFLICT,
                        "Department has active doctors and cannot be deactivated");
            }
        }
        departmentMapper.updateStatus(id, active, userId);
        existing.setActive(active);
        return existing;
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
