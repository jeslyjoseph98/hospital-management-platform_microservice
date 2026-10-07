package com.hms.doctor.service;

import com.hms.doctor.dto.DoctorRequest;
import com.hms.doctor.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.regex.Pattern;

/** DOC-R4, DOC-R5: field-level business validation beyond bean validation. */
@Component
public class DoctorValidationService {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^[6-9][0-9]{9}$");

    public void validate(DoctorRequest request) {
        if (request.getConsultationFee() != null && request.getConsultationFee().compareTo(BigDecimal.ZERO) < 0) {
            throw invalid("Consultation fee must be >= 0");
        }
        Integer experience = request.getExperienceYears();
        if (experience != null && (experience < 0 || experience > 70)) {
            throw invalid("Experience years must be between 0 and 70");
        }
        if (request.getPhone() != null && !PHONE_PATTERN.matcher(request.getPhone()).matches()) {
            throw invalid("Phone must be 10 digits starting with 6-9");
        }
        Integer dailyLimit = request.getDailyLimit();
        if (dailyLimit != null && (dailyLimit < 1 || dailyLimit > 200)) {
            throw invalid("Daily limit must be between 1 and 200");
        }
    }

    private BusinessException invalid(String message) {
        return new BusinessException("ADM_DOCTOR_INVALID", HttpStatus.BAD_REQUEST, message);
    }
}
