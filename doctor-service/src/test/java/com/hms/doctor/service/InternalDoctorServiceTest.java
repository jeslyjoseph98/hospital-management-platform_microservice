package com.hms.doctor.service;

import com.hms.doctor.dto.VerifyRegistrationResponse;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DoctorAvailabilityMapper;
import com.hms.doctor.mapper.DoctorMapper;
import com.hms.doctor.model.Department;
import com.hms.doctor.model.Doctor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InternalDoctorServiceTest {

    @Mock
    private DoctorMapper doctorMapper;
    @Mock
    private DoctorAvailabilityMapper availabilityMapper;
    @Mock
    private DepartmentService departmentService;

    @InjectMocks
    private InternalDoctorService internalDoctorService;

    private Doctor doctor;
    private Department department;

    @BeforeEach
    void setUp() {
        doctor = new Doctor();
        doctor.setId(3L);
        doctor.setFullName("Dr. Rahul Menon");
        doctor.setPhone("9876543210");
        doctor.setRegistrationNumber("KMC-45821");
        doctor.setActive(true);
        doctor.setDepartmentId(2L);
        doctor.setDailyLimit(50);

        department = new Department();
        department.setId(2L);
        department.setDeptName("Cardiology");
        department.setActive(true);
    }

    @Test
    void verifyRegistration_returnsDoctorWhenMatched() {
        when(doctorMapper.findByRegistrationNumber("KMC-45821")).thenReturn(doctor);

        VerifyRegistrationResponse response = internalDoctorService.verifyRegistration("KMC-45821", "9876543210");

        assertThat(response.getDoctorId()).isEqualTo(3L);
        assertThat(response.getFullName()).isEqualTo("Dr. Rahul Menon");
    }

    @Test
    void verifyRegistration_throwsNotFoundWhenRegistrationUnknown() {
        when(doctorMapper.findByRegistrationNumber("UNKNOWN")).thenReturn(null);

        assertThatThrownBy(() -> internalDoctorService.verifyRegistration("UNKNOWN", "9876543210"))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "DOC_NOT_FOUND");
    }

    @Test
    void verifyRegistration_throwsPhoneMismatchWhenPhoneDiffers() {
        when(doctorMapper.findByRegistrationNumber("KMC-45821")).thenReturn(doctor);

        assertThatThrownBy(() -> internalDoctorService.verifyRegistration("KMC-45821", "1111111111"))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "PHONE_MISMATCH");
    }

    @Test
    void verifyRegistration_throwsInactiveWhenDoctorInactive() {
        doctor.setActive(false);
        when(doctorMapper.findByRegistrationNumber("KMC-45821")).thenReturn(doctor);

        assertThatThrownBy(() -> internalDoctorService.verifyRegistration("KMC-45821", "9876543210"))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "INACTIVE");
    }

    @Test
    void weeklySchedule_activeFalseWhenDepartmentInactive() {
        department.setActive(false);
        when(doctorMapper.findById(3L)).thenReturn(doctor);
        when(departmentService.getByIdOrThrow(2L)).thenReturn(department);
        lenient().when(availabilityMapper.findByDoctorId(3L)).thenReturn(List.of());

        var response = internalDoctorService.getWeeklySchedule(3L);

        assertThat(response.isActive()).isFalse();
    }

    @Test
    void weeklySchedule_activeTrueWhenBothDoctorAndDepartmentActive() {
        when(doctorMapper.findById(3L)).thenReturn(doctor);
        when(departmentService.getByIdOrThrow(2L)).thenReturn(department);
        lenient().when(availabilityMapper.findByDoctorId(3L)).thenReturn(List.of());

        var response = internalDoctorService.getWeeklySchedule(3L);

        assertThat(response.isActive()).isTrue();
        assertThat(response.getDoctorId()).isEqualTo(3L);
        assertThat(response.getDepartmentName()).isEqualTo("Cardiology");
    }

    @Test
    void weeklySchedule_throwsNotFoundWhenDoctorMissing() {
        when(doctorMapper.findById(99L)).thenReturn(null);

        assertThatThrownBy(() -> internalDoctorService.getWeeklySchedule(99L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "DOC_NOT_FOUND");
    }
}
