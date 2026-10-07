package com.hms.userservice.service;

import com.hms.userservice.domain.Patient;
import com.hms.userservice.domain.User;
import com.hms.userservice.dto.PatientProfileResponse;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.mapper.PatientMapper;
import com.hms.userservice.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PatientServiceTest {

    @Mock
    private PatientMapper patientMapper;
    @Mock
    private UserMapper userMapper;

    private PatientService patientService;

    @Test
    void ownProfile_computesAgeInHospitalTimezone() {
        patientService = new PatientService(patientMapper, userMapper);

        User user = new User();
        user.setId(7L);
        user.setFullName("John Mathew");
        user.setPhone("9845012345");
        user.setEmail("john@mail.com");

        LocalDate dob = LocalDate.of(1988, 4, 12);
        Patient patient = new Patient();
        patient.setId(123L);
        patient.setPatientCode("PAT000123");
        patient.setDateOfBirth(dob);
        patient.setGender("MALE");
        patient.setAddress("Kuvempunagar, Mysuru");

        when(userMapper.findById(7L)).thenReturn(Optional.of(user));
        when(patientMapper.findByUserId(7L)).thenReturn(Optional.of(patient));

        PatientProfileResponse resp = patientService.getOwnProfile(7L);

        int expectedAge = Period.between(dob, LocalDate.now(ZoneId.of("Asia/Kolkata"))).getYears();
        assertThat(resp.getPatientId()).isEqualTo(123L);
        assertThat(resp.getPatientCode()).isEqualTo("PAT000123");
        assertThat(resp.getName()).isEqualTo("John Mathew");
        assertThat(resp.getAge()).isEqualTo(expectedAge);
    }

    @Test
    void ownProfile_userNotFound_throws() {
        patientService = new PatientService(patientMapper, userMapper);
        when(userMapper.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> patientService.getOwnProfile(99L))
                .isInstanceOf(BusinessException.class);
    }
}
