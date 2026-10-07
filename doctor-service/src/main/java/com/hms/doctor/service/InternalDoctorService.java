package com.hms.doctor.service;

import com.hms.doctor.dto.AdminTimingView;
import com.hms.doctor.dto.VerifyRegistrationResponse;
import com.hms.doctor.dto.WeeklyScheduleResponse;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DoctorAvailabilityMapper;
import com.hms.doctor.mapper.DoctorMapper;
import com.hms.doctor.model.Department;
import com.hms.doctor.model.Doctor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class InternalDoctorService {

    private final DoctorMapper doctorMapper;
    private final DoctorAvailabilityMapper availabilityMapper;
    private final DepartmentService departmentService;

    public InternalDoctorService(DoctorMapper doctorMapper,
                                  DoctorAvailabilityMapper availabilityMapper,
                                  DepartmentService departmentService) {
        this.doctorMapper = doctorMapper;
        this.availabilityMapper = availabilityMapper;
        this.departmentService = departmentService;
    }

    /**
     * Used by user-service during doctor self-registration.
     * 200 { doctorId, fullName }; 404 not found; 409 { reason: PHONE_MISMATCH } or { reason: INACTIVE }.
     */
    public VerifyRegistrationResponse verifyRegistration(String registrationNumber, String phone) {
        Doctor doctor = doctorMapper.findByRegistrationNumber(registrationNumber);
        if (doctor == null) {
            throw new BusinessException("DOC_NOT_FOUND", HttpStatus.NOT_FOUND, "Doctor not found");
        }
        if (!doctor.getPhone().equals(phone)) {
            throw new BusinessException("PHONE_MISMATCH", HttpStatus.CONFLICT, "Phone does not match");
        }
        if (!doctor.isActive()) {
            throw new BusinessException("INACTIVE", HttpStatus.CONFLICT, "Doctor is inactive");
        }
        return new VerifyRegistrationResponse(doctor.getId(), doctor.getFullName());
    }

    /** Used by appointment-service for availability and booking. active=false if doctor or department is inactive (DOC-R12). */
    public WeeklyScheduleResponse getWeeklySchedule(Long doctorId) {
        Doctor doctor = doctorMapper.findById(doctorId);
        if (doctor == null) {
            throw new BusinessException("DOC_NOT_FOUND", HttpStatus.NOT_FOUND, "Doctor not found");
        }
        Department department = departmentService.getByIdOrThrow(doctor.getDepartmentId());

        WeeklyScheduleResponse response = new WeeklyScheduleResponse();
        response.setDoctorId(doctor.getId());
        response.setFullName(doctor.getFullName());
        response.setDepartmentName(department.getDeptName());
        response.setActive(doctor.isActive() && department.isActive());
        response.setDailyLimit(doctor.getDailyLimit());
        List<AdminTimingView> timings = availabilityMapper.findByDoctorId(doctorId).stream()
                .map(a -> new AdminTimingView(a.getDayOfWeek(), a.getStartTime(), a.getEndTime()))
                .collect(Collectors.toList());
        response.setTimings(timings);
        return response;
    }
}
