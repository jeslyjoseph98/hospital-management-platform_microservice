package com.hms.userservice.service;

import com.hms.userservice.config.HmsProperties;
import com.hms.userservice.domain.Patient;
import com.hms.userservice.domain.User;
import com.hms.userservice.dto.LoginRequest;
import com.hms.userservice.dto.LoginResponse;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.mapper.PatientMapper;
import com.hms.userservice.mapper.UserMapper;
import com.hms.userservice.security.JwtService;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PatientMapper patientMapper;

    private PasswordEncoder passwordEncoder;
    private AuthService authService;
    private HmsProperties hmsProperties;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        hmsProperties = new HmsProperties();
        hmsProperties.getJwt().setSecret("dev-only-change-me-dev-only-change-me");
        hmsProperties.getJwt().setExpiryMinutes(60);
        JwtService jwtService = new JwtService(hmsProperties);
        authService = new AuthService(userMapper, patientMapper, passwordEncoder, jwtService);
    }

    private User buildUser(String role, String rawPassword) {
        User user = new User();
        user.setId(7L);
        user.setFullName("John Mathew");
        user.setPhone("9845012345");
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setActive(true);
        return user;
    }

    private LoginRequest loginRequest(String role, String phone, String password) {
        LoginRequest req = new LoginRequest();
        req.setRole(role);
        req.setPhone(phone);
        req.setPassword(password);
        return req;
    }

    // LOG-R1
    @Test
    void missingFields_rejected() {
        LoginRequest req = loginRequest(null, "9845012345", "john1234");
        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_INVALID_ROLE");
    }

    @Test
    void invalidRoleValue_rejected() {
        LoginRequest req = loginRequest("SUPERADMIN", "9845012345", "john1234");
        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("REG_INVALID_ROLE");
    }

    // LOG-R2
    @Test
    void phoneNotFound_returnsInvalidCredentials() {
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.empty());
        LoginRequest req = loginRequest("PATIENT", "9845012345", "john1234");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_INVALID_CREDENTIALS");
    }

    @Test
    void wrongPassword_returnsInvalidCredentials() {
        User user = buildUser("PATIENT", "john1234");
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));
        LoginRequest req = loginRequest("PATIENT", "9845012345", "wrongpass1");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_INVALID_CREDENTIALS");
    }

    // LOG-R3: checked only after password matches
    @Test
    void roleMismatch_afterPasswordMatches_returnsRoleMismatch() {
        User user = buildUser("DOCTOR", "john1234");
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));
        LoginRequest req = loginRequest("PATIENT", "9845012345", "john1234");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_ROLE_MISMATCH");
    }

    @Test
    void roleMismatch_withWrongPassword_stillReturnsInvalidCredentials_notRoleMismatch() {
        // Ensures password check happens first (prevents phone enumeration per LOG-R3 rationale)
        User user = buildUser("DOCTOR", "john1234");
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));
        LoginRequest req = loginRequest("PATIENT", "9845012345", "wrongpass1");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_INVALID_CREDENTIALS");
    }

    // LOG-R4
    @Test
    void inactiveAccount_rejected() {
        User user = buildUser("PATIENT", "john1234");
        user.setActive(false);
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));
        LoginRequest req = loginRequest("PATIENT", "9845012345", "john1234");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_ACCOUNT_INACTIVE");
    }

    // LOG-R5 + LOG-R6
    @Test
    void successfulPatientLogin_updatesLastLoginAndIssuesToken() {
        User user = buildUser("PATIENT", "john1234");
        Patient patient = new Patient();
        patient.setId(123L);
        patient.setPatientCode("PAT000123");
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));
        when(patientMapper.findByUserId(7L)).thenReturn(Optional.of(patient));

        LoginRequest req = loginRequest("PATIENT", "9845012345", "john1234");
        LoginResponse resp = authService.login(req);

        verify(userMapper).updateLastLoginAt(7L);
        assertThat(resp.getAccessToken()).isNotBlank();
        assertThat(resp.getExpiresIn()).isEqualTo(3600L);
        assertThat(resp.getUser().getId()).isEqualTo(7L);
        assertThat(resp.getUser().getRole()).isEqualTo("PATIENT");
        assertThat(resp.getUser().getPatientId()).isEqualTo(123L);
        assertThat(resp.getUser().getPatientCode()).isEqualTo("PAT000123");
        assertThat(resp.getUser().getDoctorId()).isNull();
    }

    @Test
    void successfulDoctorLogin_claimsIncludeDoctorId() {
        User user = buildUser("DOCTOR", "rahul1234");
        user.setDoctorId(3L);
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));

        LoginRequest req = loginRequest("DOCTOR", "9845012345", "rahul1234");
        LoginResponse resp = authService.login(req);

        assertThat(resp.getUser().getDoctorId()).isEqualTo(3L);
        assertThat(resp.getUser().getPatientId()).isNull();
        verify(patientMapper, never()).findByUserId(anyLong());
    }

    @Test
    void me_withValidToken_returnsUserSummary() {
        User user = buildUser("PATIENT", "john1234");
        when(userMapper.findByPhone("9845012345")).thenReturn(Optional.of(user));
        when(userMapper.findById(7L)).thenReturn(Optional.of(user));
        Patient patient = new Patient();
        patient.setId(123L);
        patient.setPatientCode("PAT000123");
        when(patientMapper.findByUserId(7L)).thenReturn(Optional.of(patient));

        LoginResponse loginResp = authService.login(loginRequest("PATIENT", "9845012345", "john1234"));
        String token = loginResp.getAccessToken();

        var summary = authService.me("Bearer " + token);
        assertThat(summary.getId()).isEqualTo(7L);
        assertThat(summary.getPatientId()).isEqualTo(123L);
        assertThat(summary.getPatientCode()).isEqualTo("PAT000123");
    }

    @Test
    void me_withMissingHeader_throwsTokenInvalid() {
        assertThatThrownBy(() -> authService.me(null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_TOKEN_INVALID");
    }

    @Test
    void me_withGarbageToken_throwsTokenInvalid() {
        assertThatThrownBy(() -> authService.me("Bearer not-a-real-jwt"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo("AUTH_TOKEN_INVALID");
    }
}
