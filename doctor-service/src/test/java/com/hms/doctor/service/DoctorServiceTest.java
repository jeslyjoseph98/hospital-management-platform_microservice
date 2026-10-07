package com.hms.doctor.service;

import com.hms.doctor.client.AppointmentServiceClient;
import com.hms.doctor.client.FutureCount;
import com.hms.doctor.dto.DoctorRequest;
import com.hms.doctor.event.OutboxService;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.exception.ServiceUnavailableException;
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

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoctorServiceTest {

    @Mock
    private DoctorMapper doctorMapper;
    @Mock
    private DoctorAvailabilityMapper availabilityMapper;
    @Mock
    private DepartmentService departmentService;
    @Mock
    private DoctorValidationService validationService;
    @Mock
    private AppointmentServiceClient appointmentServiceClient;
    @Mock
    private OutboxService outboxService;

    @InjectMocks
    private DoctorService doctorService;

    private Doctor existingDoctor;
    private Department activeDepartment;

    @BeforeEach
    void setUp() {
        existingDoctor = new Doctor();
        existingDoctor.setId(10L);
        existingDoctor.setDepartmentId(1L);
        existingDoctor.setFullName("Dr. Rahul Menon");
        existingDoctor.setQualification("MBBS");
        existingDoctor.setSpecialization("Cardiologist");
        existingDoctor.setRegistrationNumber("KMC-45821");
        existingDoctor.setExperienceYears(10);
        existingDoctor.setPhone("9876543210");
        existingDoctor.setConsultationFee(new BigDecimal("500.00"));
        existingDoctor.setDailyLimit(50);
        existingDoctor.setLoginRegistered(false);
        existingDoctor.setActive(true);

        activeDepartment = new Department();
        activeDepartment.setId(1L);
        activeDepartment.setDeptName("Cardiology");
        activeDepartment.setActive(true);
    }

    private DoctorRequest baseRequest() {
        DoctorRequest r = new DoctorRequest();
        r.setDepartmentId(1L);
        r.setFullName("Dr. Rahul Menon");
        r.setQualification("MBBS");
        r.setSpecialization("Cardiologist");
        r.setRegistrationNumber("KMC-45821");
        r.setExperienceYears(10);
        r.setPhone("9876543210");
        r.setConsultationFee(new BigDecimal("500.00"));
        r.setDailyLimit(50);
        return r;
    }

    // ---------- Registration-number lock (DOC-R8) ----------

    @Test
    void update_blocksRegistrationNumberChangeWhenLoginRegistered() {
        existingDoctor.setLoginRegistered(true);
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);

        DoctorRequest request = baseRequest();
        request.setRegistrationNumber("KMC-99999"); // changed

        assertThatThrownBy(() -> doctorService.update(10L, request, 1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DOCTOR_REG_LOCKED");

        verify(doctorMapper, never()).update(any());
    }

    @Test
    void update_allowsRegistrationNumberChangeWhenNotLoginRegistered() {
        existingDoctor.setLoginRegistered(false);
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);

        DoctorRequest request = baseRequest();
        request.setRegistrationNumber("KMC-99999");

        Doctor updated = doctorService.update(10L, request, 1L);

        assertThat(updated.getRegistrationNumber()).isEqualTo("KMC-99999");
        verify(doctorMapper).update(any(Doctor.class));
    }

    @Test
    void update_allowsSameRegistrationNumberEvenWhenLoginRegistered() {
        existingDoctor.setLoginRegistered(true);
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);

        DoctorRequest request = baseRequest(); // same registration number as existing

        Doctor updated = doctorService.update(10L, request, 1L);

        assertThat(updated.getRegistrationNumber()).isEqualTo("KMC-45821");
        verify(doctorMapper).update(any(Doctor.class));
    }

    // ---------- Daily-limit reduction gating (DOC-R6) ----------

    @Test
    void update_blocksDailyLimitReductionWhenFutureBookingsExceedNewLimit() {
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);

        FutureCount fc = new FutureCount();
        fc.setDate("2026-10-10");
        fc.setDayOfWeek(6);
        fc.setCount(30);
        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of(fc));

        DoctorRequest request = baseRequest();
        request.setDailyLimit(20); // reducing from 50 to 20, below the 30 booked

        assertThatThrownBy(() -> doctorService.update(10L, request, 1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_LIMIT_BELOW_BOOKED");

        verify(doctorMapper, never()).update(any());
    }

    @Test
    void update_allowsDailyLimitReductionWhenNoFutureDateExceedsNewLimit() {
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);

        FutureCount fc = new FutureCount();
        fc.setDate("2026-10-10");
        fc.setDayOfWeek(6);
        fc.setCount(10);
        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of(fc));

        DoctorRequest request = baseRequest();
        request.setDailyLimit(20); // reducing from 50 to 20, 10 booked is fine

        Doctor updated = doctorService.update(10L, request, 1L);

        assertThat(updated.getDailyLimit()).isEqualTo(20);
        verify(doctorMapper).update(any(Doctor.class));
    }

    @Test
    void update_doesNotCallFutureCountsWhenLimitIncreased() {
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);

        DoctorRequest request = baseRequest();
        request.setDailyLimit(100); // increasing from 50

        doctorService.update(10L, request, 1L);

        verify(appointmentServiceClient, never()).getFutureCounts(anyLong());
        verify(doctorMapper).update(any(Doctor.class));
    }

    @Test
    void update_propagatesServiceUnavailableWhenAppointmentServiceDown() {
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumberExcludingId(anyString(), eq(10L))).thenReturn(null);
        when(appointmentServiceClient.getFutureCounts(10L))
                .thenThrow(new ServiceUnavailableException("down"));

        DoctorRequest request = baseRequest();
        request.setDailyLimit(10);

        assertThatThrownBy(() -> doctorService.update(10L, request, 1L))
                .isInstanceOf(ServiceUnavailableException.class);

        verify(doctorMapper, never()).update(any());
    }

    // ---------- Deactivate-with-bookings block (DOC-R10) ----------

    @Test
    void updateStatus_blocksDeactivationWhenFutureBookingsExist() {
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        FutureCount fc = new FutureCount();
        fc.setDate("2026-10-12");
        fc.setCount(5);
        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of(fc));

        assertThatThrownBy(() -> doctorService.updateStatus(10L, false, 1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DOCTOR_HAS_BOOKINGS");

        verify(doctorMapper, never()).updateStatus(anyLong(), anyBoolean(), any());
        verify(outboxService, never()).save(anyString(), anyString(), anyString(), any());
    }

    @Test
    void updateStatus_allowsDeactivationWhenNoFutureBookings() {
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);
        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of());

        Doctor result = doctorService.updateStatus(10L, false, 1L);

        assertThat(result.isActive()).isFalse();
        verify(doctorMapper).updateStatus(10L, false, 1L);
        verify(outboxService).save(eq("doctor.status-changed"), eq("10"), eq("doctor.status-changed"), any());
    }

    @Test
    void updateStatus_activatingDoesNotCheckFutureBookings() {
        existingDoctor.setActive(false);
        when(doctorMapper.findById(10L)).thenReturn(existingDoctor);

        Doctor result = doctorService.updateStatus(10L, true, 1L);

        assertThat(result.isActive()).isTrue();
        verify(appointmentServiceClient, never()).getFutureCounts(anyLong());
        verify(outboxService).save(eq("doctor.status-changed"), eq("10"), eq("doctor.status-changed"), any());
    }

    // ---------- Create: department must be active (DOC-R2), reg number unique (DOC-R3) ----------

    @Test
    void create_rejectsDuplicateRegistrationNumber() {
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumber("KMC-45821")).thenReturn(existingDoctor);

        assertThatThrownBy(() -> doctorService.create(baseRequest(), 1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DOCTOR_REG_EXISTS");

        verify(doctorMapper, never()).insert(any());
    }

    @Test
    void create_defaultsDailyLimitTo50WhenNotProvided() {
        when(departmentService.getActiveOrThrow(1L)).thenReturn(activeDepartment);
        when(doctorMapper.findByRegistrationNumber(anyString())).thenReturn(null);

        DoctorRequest request = baseRequest();
        request.setDailyLimit(null);

        Doctor created = doctorService.create(request, 1L);

        assertThat(created.getDailyLimit()).isEqualTo(50);
    }
}
