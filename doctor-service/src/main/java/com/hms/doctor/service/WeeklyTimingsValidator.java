package com.hms.doctor.service;

import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.model.DoctorAvailability;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** AVL-R1..R3: structural validation shared by create and replace paths. */
public final class WeeklyTimingsValidator {

    private WeeklyTimingsValidator() {
    }

    public static void validateStructure(List<DoctorAvailability> timings, int dailyLimit) {
        Set<Integer> seenDays = new HashSet<>();
        for (DoctorAvailability t : timings) {
            // AVL-R1: at most one entry per day; dayOfWeek 1-7
            if (t.getDayOfWeek() == null || t.getDayOfWeek() < 1 || t.getDayOfWeek() > 7) {
                throw new BusinessException("ADM_DUPLICATE_DAY", HttpStatus.BAD_REQUEST,
                        "dayOfWeek must be between 1 and 7");
            }
            if (!seenDays.add(t.getDayOfWeek())) {
                throw new BusinessException("ADM_DUPLICATE_DAY", HttpStatus.BAD_REQUEST,
                        "Duplicate entry for day " + t.getDayOfWeek());
            }
            // AVL-R2: endTime after startTime
            if (t.getStartTime() == null || t.getEndTime() == null || !t.getEndTime().isAfter(t.getStartTime())) {
                throw new BusinessException("ADM_INVALID_TIME", HttpStatus.BAD_REQUEST,
                        "endTime must be after startTime for day " + t.getDayOfWeek());
            }
            // AVL-R3: window length in minutes >= daily_limit
            long minutes = Duration.between(t.getStartTime(), t.getEndTime()).toMinutes();
            if (minutes < dailyLimit) {
                throw new BusinessException("ADM_WINDOW_TOO_SHORT", HttpStatus.BAD_REQUEST,
                        "Window for day " + t.getDayOfWeek() + " must be at least " + dailyLimit + " minutes long");
            }
        }
    }
}
