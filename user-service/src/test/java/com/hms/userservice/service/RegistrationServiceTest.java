package com.hms.userservice.service;

import com.hms.userservice.client.DoctorServiceClient;
import com.hms.userservice.client.DoctorVerificationResult;
import com.hms.userservice.config.HmsProperties;
import com.hms.userservice.domain.Patient;
import com.hms.userservice.domain.User;
import com.hms.userservice.dto.RegisterRequest;
import com.hms.userservice.dto.RegisterResponse;
import com.hms.userservice.event.OutboxEventWriter;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.exception.ValidationFailedException;
import com.hms.userservice.mapper.PatientMapper;
import com.hms.userservice.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PatientMapper patientMapper;
    @Mock
    private DoctorServiceClient doctorServiceClient;
    @Mock
    private OutboxEventWriter outboxEventWriter;

    private PasswordEncoder passwordEncoder;
    private HmsProperties hmsProperties;
    private RegistrationService service;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        hmsProperties = new HmsProperties();
        hmsProperties.setAdminRegistrationCode("HMS-ADMIN-2026");
        hmsProperties.setPharmacyRegistrationCode("HMS-PHARM-2026");
        service = new RegistrationService(userMapper, patientMapper, passwordEncoder, hmsProperties,
                doctorServiceClient, outboxEventWriter);
    }

    private RegisterRequest patientRequest() {
        RegisterRequest req = new RegisterRequest();
        req.setRole("PATIENT");
        req.setFullName("John Mathew");
        req.setPhone("9845012345");
        req.setEmail("john@mail.com");
        req.setPassword("john1234");
        req.setDateOfBirth(LocalDate.of(1988, 4, 12));
        req.setGender("MALE");
        req.setAddress("Kuvempunagar, Mysuru");
        return req;
    }

    // REG-R1
    @Test
    void invalidRole_rejected() {
        RegisterRequest req = patientRequest();
        req.setRole("SUPERADMIN");

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_INVALID_ROLE");
    }

    @Test
    void nullRole_rejected() {
        RegisterRequest req = patientRequest();
        req.setRole(null);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_INVALID_ROLE");
    }

    // REG-R2
    @Test
    void missingRequiredFields_returnsFieldErrors() {
        RegisterRequest req = patientRequest();
        req.setFullName(null);
        req.setPhone("");
        req.setPassword(null);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(ValidationFailedException.class)
                .satisfies(e -> {
                    ValidationFailedException vfe = (ValidationFailedException) e;
                    assertThat(vfe.getFieldErrors()).extracting("field")
                            .containsExactlyInAnyOrder("fullName", "phone", "password");
                });
    }

    // REG-R3
    @Test
    void phoneNotTenDigits_rejected() {
        RegisterRequest req = patientRequest();
        req.setPhone("12345");

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_PHONE_INVALID");
    }

    @Test
    void phoneStartingWithInvalidDigit_rejected() {
        RegisterRequest req = patientRequest();
        req.setPhone("5845012345");

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_PHONE_INVALID");
    }

    @Test
    void phoneStartingWith6to9_accepted() {
        RegisterRequest req = patientRequest();
        req.setPhone("6845012345");
        when(userMapper.findByPhone("6845012345")).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);
        stubPatientInsert();

        RegisterResponse resp = service.register(req);
        assertThat(resp.getUserId()).isNotNull();
    }

    // REG-R4
    @Test
    void duplicatePhone_rejected() {
        RegisterRequest req = patientRequest();
        User existing = new User();
        existing.setId(1L);
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_PHONE_EXISTS");
    }

    // REG-R5
    @Test
    void duplicateEmail_rejected() {
        RegisterRequest req = patientRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(req.getEmail())).thenReturn(true);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_EMAIL_EXISTS");
    }

    // REG-R6
    @Test
    void shortPassword_rejected() {
        RegisterRequest req = patientRequest();
        req.setPassword("abc123");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_WEAK_PASSWORD");
    }

    @Test
    void passwordWithoutDigit_rejected() {
        RegisterRequest req = patientRequest();
        req.setPassword("abcdefgh");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_WEAK_PASSWORD");
    }

    @Test
    void passwordWithoutLetter_rejected() {
        RegisterRequest req = patientRequest();
        req.setPassword("12345678");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_WEAK_PASSWORD");
    }

    // REG-R7
    @Test
    void patientMissingDobAndGender_returnsFieldErrors() {
        RegisterRequest req = patientRequest();
        req.setDateOfBirth(null);
        req.setGender(null);
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(ValidationFailedException.class)
                .satisfies(e -> {
                    ValidationFailedException vfe = (ValidationFailedException) e;
                    assertThat(vfe.getFieldErrors()).extracting("field")
                            .containsExactlyInAnyOrder("dateOfBirth", "gender");
                });
    }

    @Test
    void patientInvalidGender_rejected() {
        RegisterRequest req = patientRequest();
        req.setGender("UNKNOWN");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_DOB_INVALID");
    }

    @Test
    void patientFutureDob_rejected() {
        RegisterRequest req = patientRequest();
        req.setDateOfBirth(LocalDate.now().plusDays(1));
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_DOB_INVALID");
    }

    // REG-R8
    @Test
    void adminWrongCode_rejected() {
        RegisterRequest req = new RegisterRequest();
        req.setRole("ADMIN");
        req.setFullName("Anita Rao");
        req.setPhone("9900112233");
        req.setPassword("anita1234");
        req.setAdminCode("WRONG-CODE");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_ADMIN_CODE_INVALID");
    }

    @Test
    void adminCorrectCode_accepted() {
        RegisterRequest req = new RegisterRequest();
        req.setRole("ADMIN");
        req.setFullName("Anita Rao");
        req.setPhone("9900112233");
        req.setPassword("anita1234");
        req.setAdminCode("HMS-ADMIN-2026");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        doAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(10L);
            return 1;
        }).when(userMapper).insert(any(User.class));

        RegisterResponse resp = service.register(req);
        assertThat(resp.getRole()).isEqualTo("ADMIN");
        assertThat(resp.getPatientCode()).isNull();
    }

    // REG-R9
    @Test
    void pharmacistWrongStaffCode_rejected() {
        RegisterRequest req = new RegisterRequest();
        req.setRole("PHARMACIST");
        req.setFullName("Priya S");
        req.setPhone("9123456780");
        req.setPassword("priya1234");
        req.setStaffCode("WRONG");
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_STAFF_CODE_INVALID");
    }

    // REG-R10
    @Test
    void doctorMissingRegistrationNumber_returnsFieldError() {
        RegisterRequest req = new RegisterRequest();
        req.setRole("DOCTOR");
        req.setFullName("Dr. Rahul Menon");
        req.setPhone("9876543210");
        req.setPassword("rahul1234");

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(ValidationFailedException.class)
                .satisfies(e -> {
                    ValidationFailedException vfe = (ValidationFailedException) e;
                    assertThat(vfe.getFieldErrors()).extracting("field").contains("registrationNumber");
                });
    }

    // REG-R11
    @Test
    void doctorNotFoundInDoctorService_rejected() {
        RegisterRequest req = doctorRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone()))
                .thenReturn(DoctorVerificationResult.of(DoctorVerificationResult.Status.NOT_FOUND));

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_DOCTOR_NOT_FOUND");
    }

    @Test
    void doctorPhoneMismatch_rejected() {
        RegisterRequest req = doctorRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone()))
                .thenReturn(DoctorVerificationResult.of(DoctorVerificationResult.Status.PHONE_MISMATCH));

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_DOCTOR_PHONE_MISMATCH");
    }

    @Test
    void doctorInactive_mapsToDoctorNotFound() {
        RegisterRequest req = doctorRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone()))
                .thenReturn(DoctorVerificationResult.of(DoctorVerificationResult.Status.INACTIVE));

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_DOCTOR_NOT_FOUND");
    }

    @Test
    void doctorServiceDown_propagatesServiceUnavailable() {
        RegisterRequest req = doctorRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone()))
                .thenThrow(new BusinessException("SERVICE_UNAVAILABLE",
                        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "down"));

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("SERVICE_UNAVAILABLE");
        verify(userMapper, never()).insert(any());
    }

    // REG-R12
    @Test
    void doctorAlreadyRegistered_rejected() {
        RegisterRequest req = doctorRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone()))
                .thenReturn(DoctorVerificationResult.found(3L, "Dr. Rahul Menon"));
        when(userMapper.findByDoctorId(3L)).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_DOCTOR_ALREADY_REGISTERED");
    }

    // REG-R13: successful doctor registration writes outbox event
    @Test
    void doctorRegistration_success_writesOutboxEvent() {
        RegisterRequest req = doctorRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone()))
                .thenReturn(DoctorVerificationResult.found(3L, "Dr. Rahul Menon"));
        when(userMapper.findByDoctorId(3L)).thenReturn(Optional.empty());
        doAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(7L);
            return 1;
        }).when(userMapper).insert(any(User.class));

        RegisterResponse resp = service.register(req);

        assertThat(resp.getUserId()).isEqualTo(7L);
        assertThat(resp.getRole()).isEqualTo("DOCTOR");
        assertThat(resp.getPatientCode()).isNull();

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(outboxEventWriter).write(eq("user.doctor-account-registered"), eq("3"), payloadCaptor.capture());
    }

    // REG-R13: successful patient registration generates patient code
    @Test
    void patientRegistration_success_generatesPatientCode() {
        RegisterRequest req = patientRequest();
        when(userMapper.findByPhone(req.getPhone())).thenReturn(Optional.empty());
        when(userMapper.existsByEmail(req.getEmail())).thenReturn(false);
        stubPatientInsert();

        RegisterResponse resp = service.register(req);

        assertThat(resp.getPatientCode()).isEqualTo("PAT000123");
        verify(outboxEventWriter, never()).write(anyString(), anyString(), any());
    }

    private void stubPatientInsert() {
        doAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(7L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        doAnswer(inv -> {
            Patient p = inv.getArgument(0);
            p.setId(123L);
            return 1;
        }).when(patientMapper).insert(any(Patient.class));
        when(patientMapper.updatePatientCode(eq(123L), anyString())).thenReturn(1);
    }

    private RegisterRequest doctorRequest() {
        RegisterRequest req = new RegisterRequest();
        req.setRole("DOCTOR");
        req.setFullName("Dr. Rahul Menon");
        req.setPhone("9876543210");
        req.setPassword("rahul1234");
        req.setRegistrationNumber("KMC-45821");
        return req;
    }
}
