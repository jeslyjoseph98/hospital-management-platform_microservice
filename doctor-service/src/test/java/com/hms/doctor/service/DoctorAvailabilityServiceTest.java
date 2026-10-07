package com.hms.doctor.service;

import com.hms.doctor.client.AppointmentServiceClient;
import com.hms.doctor.client.FutureCount;
import com.hms.doctor.dto.AdminTimingView;
import com.hms.doctor.dto.TimingRequest;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DoctorAvailabilityMapper;
import com.hms.doctor.model.Doctor;
import com.hms.doctor.model.DoctorAvailability;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoctorAvailabilityServiceTest {

    @Mock
    private DoctorAvailabilityMapper availabilityMapper;
    @Mock
    private DoctorService doctorService;
    @Mock
    private AppointmentServiceClient appointmentServiceClient;

    @InjectMocks
    private DoctorAvailabilityService availabilityService;

    private Doctor doctor;

    @BeforeEach
    void setUp() {
        doctor = new Doctor();
        doctor.setId(10L);
        doctor.setDailyLimit(50);
        when(doctorService.getByIdOrThrow(10L)).thenReturn(doctor);
    }

    private TimingRequest timing(int day, String start, String end) {
        TimingRequest t = new TimingRequest();
        t.setDayOfWeek(day);
        t.setStartTime(LocalTime.parse(start));
        t.setEndTime(LocalTime.parse(end));
        return t;
    }

    private DoctorAvailability existing(int day, String start, String end) {
        DoctorAvailability a = new DoctorAvailability();
        a.setDoctorId(10L);
        a.setDayOfWeek(day);
        a.setStartTime(LocalTime.parse(start));
        a.setEndTime(LocalTime.parse(end));
        return a;
    }

    // ---------- AVL-R1: duplicate day ----------

    @Test
    void replace_rejectsDuplicateDay() {
        lenient().when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of());

        List<TimingRequest> timings = List.of(
                timing(1, "10:00", "13:00"),
                timing(1, "14:00", "17:00"));

        assertThatThrownBy(() -> availabilityService.replace(10L, timings))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DUPLICATE_DAY");
    }

    // ---------- AVL-R2: endTime after startTime ----------

    @Test
    void replace_rejectsEndBeforeStart() {
        lenient().when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of());

        List<TimingRequest> timings = List.of(timing(1, "13:00", "10:00"));

        assertThatThrownBy(() -> availabilityService.replace(10L, timings))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_INVALID_TIME");
    }

    // ---------- AVL-R3: window too short for daily limit ----------

    @Test
    void replace_rejectsWindowShorterThanDailyLimitMinutes() {
        doctor.setDailyLimit(50);
        lenient().when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of());

        // only 30 minutes window but daily limit is 50 (needs >= 1 min/token)
        List<TimingRequest> timings = List.of(timing(1, "10:00", "10:30"));

        assertThatThrownBy(() -> availabilityService.replace(10L, timings))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_WINDOW_TOO_SHORT");
    }

    @Test
    void replace_acceptsWindowExactlyEqualToDailyLimitMinutes() {
        doctor.setDailyLimit(60);
        when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of());

        List<TimingRequest> timings = List.of(timing(1, "10:00", "11:00")); // exactly 60 minutes

        List<AdminTimingView> result = availabilityService.replace(10L, timings);

        assertThat(result).hasSize(1);
        verify(availabilityMapper).deleteByDoctorId(10L);
        verify(availabilityMapper).insert(any(DoctorAvailability.class));
    }

    // ---------- AVL-R4: removed day with future bookings ----------

    @Test
    void replace_blocksRemovingDayWithFutureBookings() {
        // existing has Monday(1) and Wednesday(3); new only has Monday -> Wednesday removed
        when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of(
                existing(1, "10:00", "13:00"),
                existing(3, "14:00", "17:00")));

        FutureCount fc = new FutureCount();
        fc.setDate("2026-10-14"); // a Wednesday
        fc.setDayOfWeek(3);
        fc.setCount(5);
        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of(fc));

        List<TimingRequest> newTimings = List.of(timing(1, "10:00", "13:00"));

        assertThatThrownBy(() -> availabilityService.replace(10L, newTimings))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DAY_HAS_BOOKINGS");

        verify(availabilityMapper, never()).deleteByDoctorId(anyLong());
    }

    @Test
    void replace_allowsRemovingDayWithNoFutureBookings() {
        when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of(
                existing(1, "10:00", "13:00"),
                existing(3, "14:00", "17:00")));

        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of());

        List<TimingRequest> newTimings = List.of(timing(1, "10:00", "13:00"));

        List<AdminTimingView> result = availabilityService.replace(10L, newTimings);

        assertThat(result).hasSize(1);
        verify(availabilityMapper).deleteByDoctorId(10L);
    }

    // ---------- AVL-R5: startTime change with future bookings ----------

    @Test
    void replace_blocksStartTimeChangeWithFutureBookings() {
        when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of(
                existing(1, "10:00", "13:00")));

        FutureCount fc = new FutureCount();
        fc.setDate("2026-10-12"); // a Monday
        fc.setDayOfWeek(1);
        fc.setCount(3);
        when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of(fc));

        // moving start time earlier
        List<TimingRequest> newTimings = List.of(timing(1, "09:00", "13:00"));

        assertThatThrownBy(() -> availabilityService.replace(10L, newTimings))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DAY_HAS_BOOKINGS");
    }

    @Test
    void replace_allowsExtendingEndTimeFreelyEvenWithFutureBookings() {
        when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of(
                existing(1, "10:00", "13:00")));

        // Only extending endTime - startTime unchanged, so future-counts should not even block it.
        // We still stub it in case the implementation calls it defensively, but it should return bookings
        // that must NOT trigger a block since startTime didn't change.
        FutureCount fc = new FutureCount();
        fc.setDate("2026-10-12");
        fc.setDayOfWeek(1);
        fc.setCount(10);
        lenient().when(appointmentServiceClient.getFutureCounts(10L)).thenReturn(List.of(fc));

        List<TimingRequest> newTimings = List.of(timing(1, "10:00", "15:00")); // extended endTime only

        List<AdminTimingView> result = availabilityService.replace(10L, newTimings);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEndTime()).isEqualTo(LocalTime.parse("15:00"));
        verify(availabilityMapper).deleteByDoctorId(10L);
    }

    @Test
    void replace_addingNewDayDoesNotRequireFutureCountsCheck() {
        when(availabilityMapper.findByDoctorId(10L)).thenReturn(List.of(
                existing(1, "10:00", "13:00")));

        List<TimingRequest> newTimings = List.of(
                timing(1, "10:00", "13:00"),
                timing(3, "14:00", "17:00")); // adding Wednesday, nothing removed or start-changed

        List<AdminTimingView> result = availabilityService.replace(10L, newTimings);

        assertThat(result).hasSize(2);
        verify(appointmentServiceClient, never()).getFutureCounts(anyLong());
        verify(availabilityMapper).deleteByDoctorId(10L);
    }
}
