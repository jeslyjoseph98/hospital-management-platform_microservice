package com.hms.doctor.service;

import com.hms.doctor.client.AppointmentServiceClient;
import com.hms.doctor.client.FutureCount;
import com.hms.doctor.dto.AdminTimingView;
import com.hms.doctor.dto.AffectedDate;
import com.hms.doctor.dto.TimingRequest;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DoctorAvailabilityMapper;
import com.hms.doctor.model.Doctor;
import com.hms.doctor.model.DoctorAvailability;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** AVL-R1..R6: full-week timing replace with booking-safety checks. */
@Service
public class DoctorAvailabilityService {

    private final DoctorAvailabilityMapper availabilityMapper;
    private final DoctorService doctorService;
    private final AppointmentServiceClient appointmentServiceClient;

    public DoctorAvailabilityService(DoctorAvailabilityMapper availabilityMapper,
                                      DoctorService doctorService,
                                      AppointmentServiceClient appointmentServiceClient) {
        this.availabilityMapper = availabilityMapper;
        this.doctorService = doctorService;
        this.appointmentServiceClient = appointmentServiceClient;
    }

    public List<AdminTimingView> getTimings(Long doctorId) {
        doctorService.getByIdOrThrow(doctorId);
        return availabilityMapper.findByDoctorId(doctorId).stream()
                .map(a -> new AdminTimingView(a.getDayOfWeek(), a.getStartTime(), a.getEndTime()))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<AdminTimingView> replace(Long doctorId, List<TimingRequest> newTimingRequests) {
        Doctor doctor = doctorService.getByIdOrThrow(doctorId);

        List<DoctorAvailability> newTimings = new ArrayList<>();
        for (TimingRequest t : newTimingRequests == null ? List.<TimingRequest>of() : newTimingRequests) {
            DoctorAvailability a = new DoctorAvailability();
            a.setDoctorId(doctorId);
            a.setDayOfWeek(t.getDayOfWeek());
            a.setStartTime(t.getStartTime());
            a.setEndTime(t.getEndTime());
            newTimings.add(a);
        }

        // AVL-R1..R3: structural validation
        WeeklyTimingsValidator.validateStructure(newTimings, doctor.getDailyLimit());

        List<DoctorAvailability> existingTimings = availabilityMapper.findByDoctorId(doctorId);
        Map<Integer, DoctorAvailability> existingByDay = existingTimings.stream()
                .collect(Collectors.toMap(DoctorAvailability::getDayOfWeek, a -> a));
        Map<Integer, DoctorAvailability> newByDay = newTimings.stream()
                .collect(Collectors.toMap(DoctorAvailability::getDayOfWeek, a -> a));

        // Determine days removed and days whose startTime changes (earlier or otherwise changed)
        List<Integer> removedDays = new ArrayList<>();
        List<Integer> startChangedDays = new ArrayList<>();
        for (Map.Entry<Integer, DoctorAvailability> entry : existingByDay.entrySet()) {
            Integer day = entry.getKey();
            DoctorAvailability oldTiming = entry.getValue();
            DoctorAvailability newTiming = newByDay.get(day);
            if (newTiming == null) {
                // AVL-R4: day removed
                removedDays.add(day);
            } else if (!newTiming.getStartTime().equals(oldTiming.getStartTime())) {
                // AVL-R5: startTime changes (any change, since only extending endTime is freely allowed)
                startChangedDays.add(day);
            }
        }

        if (!removedDays.isEmpty() || !startChangedDays.isEmpty()) {
            List<FutureCount> futureCounts = appointmentServiceClient.getFutureCounts(doctorId);

            if (!removedDays.isEmpty()) {
                List<AffectedDate> affected = affectedForDays(futureCounts, removedDays);
                if (!affected.isEmpty()) {
                    throw new BusinessException("ADM_DAY_HAS_BOOKINGS", HttpStatus.CONFLICT,
                            dayRemovedMessage(removedDays, affected),
                            new DoctorService.AffectedDataWrapper(affected));
                }
            }
            if (!startChangedDays.isEmpty()) {
                List<AffectedDate> affected = affectedForDays(futureCounts, startChangedDays);
                if (!affected.isEmpty()) {
                    throw new BusinessException("ADM_DAY_HAS_BOOKINGS", HttpStatus.CONFLICT,
                            "Start time change rejected: there are future bookings.",
                            new DoctorService.AffectedDataWrapper(affected));
                }
            }
        }

        // AVL-R6: delete then insert in one transaction
        availabilityMapper.deleteByDoctorId(doctorId);
        for (DoctorAvailability a : newTimings) {
            availabilityMapper.insert(a);
        }

        return newTimings.stream()
                .map(a -> new AdminTimingView(a.getDayOfWeek(), a.getStartTime(), a.getEndTime()))
                .collect(Collectors.toList());
    }

    private List<AffectedDate> affectedForDays(List<FutureCount> futureCounts, List<Integer> days) {
        return futureCounts.stream()
                .filter(fc -> fc.getCount() != null && fc.getCount() > 0)
                .filter(fc -> days.contains(resolveDayOfWeek(fc)))
                .map(fc -> new AffectedDate(fc.getDate(), fc.getCount()))
                .collect(Collectors.toList());
    }

    /** Prefer the dayOfWeek field from appointment-service; fall back to computing it from the date (1=Mon..7=Sun). */
    private Integer resolveDayOfWeek(FutureCount fc) {
        if (fc.getDayOfWeek() != null) {
            return fc.getDayOfWeek();
        }
        if (fc.getDate() != null) {
            DayOfWeek dow = LocalDate.parse(fc.getDate()).getDayOfWeek();
            return dow.getValue();
        }
        return null;
    }

    private String dayRemovedMessage(List<Integer> removedDays, List<AffectedDate> affected) {
        String dayName = com.hms.doctor.util.DayOfWeekUtil.name(removedDays.get(0));
        String capitalized = dayName.substring(0, 1) + dayName.substring(1).toLowerCase();
        return capitalized + " cannot be removed: there are future bookings.";
    }
}
