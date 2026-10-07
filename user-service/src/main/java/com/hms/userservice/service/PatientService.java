package com.hms.userservice.service;

import com.hms.userservice.domain.Patient;
import com.hms.userservice.domain.User;
import com.hms.userservice.dto.InternalPatientResponse;
import com.hms.userservice.dto.PatientProfileResponse;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.mapper.PatientMapper;
import com.hms.userservice.mapper.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;

/**
 * SVC-02 section 6.3 (/patients/me) and section 7 (/internal/patients/{id}).
 */
@Service
public class PatientService {

    private static final ZoneId HOSPITAL_ZONE = ZoneId.of("Asia/Kolkata");

    private final PatientMapper patientMapper;
    private final UserMapper userMapper;

    public PatientService(PatientMapper patientMapper, UserMapper userMapper) {
        this.patientMapper = patientMapper;
        this.userMapper = userMapper;
    }

    public PatientProfileResponse getOwnProfile(Long userId) {
        User user = userMapper.findById(userId)
                .orElseThrow(() -> new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "User not found"));
        Patient patient = patientMapper.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "Patient profile not found"));

        PatientProfileResponse resp = new PatientProfileResponse();
        resp.setPatientId(patient.getId());
        resp.setPatientCode(patient.getPatientCode());
        resp.setName(user.getFullName());
        resp.setPhone(user.getPhone());
        resp.setEmail(user.getEmail());
        resp.setDateOfBirth(patient.getDateOfBirth());
        resp.setAge(computeAge(patient.getDateOfBirth()));
        resp.setGender(patient.getGender());
        resp.setAddress(patient.getAddress());
        return resp;
    }

    public InternalPatientResponse getById(Long patientId) {
        Patient patient = patientMapper.findById(patientId)
                .orElseThrow(() -> new BusinessException("PATIENT_NOT_FOUND", HttpStatus.NOT_FOUND, "Patient not found"));
        User user = userMapper.findById(patient.getUserId())
                .orElseThrow(() -> new BusinessException("PATIENT_NOT_FOUND", HttpStatus.NOT_FOUND, "Patient not found"));

        InternalPatientResponse resp = new InternalPatientResponse();
        resp.setPatientId(patient.getId());
        resp.setPatientCode(patient.getPatientCode());
        resp.setName(user.getFullName());
        resp.setPhone(user.getPhone());
        resp.setDateOfBirth(patient.getDateOfBirth());
        resp.setGender(patient.getGender());
        resp.setAddress(patient.getAddress());
        return resp;
    }

    private int computeAge(LocalDate dateOfBirth) {
        LocalDate today = LocalDate.now(HOSPITAL_ZONE);
        return Period.between(dateOfBirth, today).getYears();
    }
}
