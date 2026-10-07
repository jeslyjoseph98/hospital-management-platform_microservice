package com.hms.userservice.service;

import com.hms.userservice.domain.Patient;
import com.hms.userservice.domain.User;
import com.hms.userservice.dto.LoginRequest;
import com.hms.userservice.dto.LoginResponse;
import com.hms.userservice.dto.UserSummary;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.mapper.PatientMapper;
import com.hms.userservice.mapper.UserMapper;
import com.hms.userservice.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;

/**
 * Implements SVC-02 section 5 (LOG-R1..LOG-R6) and /auth/me self-validation.
 */
@Service
public class AuthService {

    private static final Set<String> VALID_ROLES = Set.of("PATIENT", "DOCTOR", "PHARMACIST", "ADMIN");

    private final UserMapper userMapper;
    private final PatientMapper patientMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserMapper userMapper, PatientMapper patientMapper,
                        PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userMapper = userMapper;
        this.patientMapper = patientMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public LoginResponse login(LoginRequest req) {
        // LOG-R1
        if (isBlank(req.getRole()) || isBlank(req.getPhone()) || isBlank(req.getPassword())) {
            throw new BusinessException("REG_INVALID_ROLE", HttpStatus.BAD_REQUEST, "role, phone and password are required");
        }
        if (!VALID_ROLES.contains(req.getRole())) {
            throw new BusinessException("REG_INVALID_ROLE", HttpStatus.BAD_REQUEST, "role must be one of PATIENT, DOCTOR, PHARMACIST, ADMIN");
        }

        // LOG-R2
        User user = userMapper.findByPhone(req.getPhone()).orElse(null);
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("AUTH_INVALID_CREDENTIALS", HttpStatus.UNAUTHORIZED,
                    "Phone or password is incorrect");
        }

        // LOG-R3 (after password check)
        if (!req.getRole().equals(user.getRole())) {
            throw new BusinessException("AUTH_ROLE_MISMATCH", HttpStatus.UNAUTHORIZED,
                    "This account is not registered as " + capitalize(req.getRole()));
        }

        // LOG-R4
        if (!user.isActive()) {
            throw new BusinessException("AUTH_ACCOUNT_INACTIVE", HttpStatus.UNAUTHORIZED, "This account is inactive");
        }

        // LOG-R5
        userMapper.updateLastLoginAt(user.getId());

        Long patientId = null;
        String patientCode = null;
        if ("PATIENT".equals(user.getRole())) {
            Patient patient = patientMapper.findByUserId(user.getId()).orElse(null);
            if (patient != null) {
                patientId = patient.getId();
                patientCode = patient.getPatientCode();
            }
        }

        String token = jwtService.issueToken(user, patientId, patientCode);
        UserSummary summary = new UserSummary(user.getId(), user.getFullName(), user.getRole(),
                patientId, patientCode, user.getDoctorId());

        return new LoginResponse(token, jwtService.expirySeconds(), summary);
    }

    /**
     * /auth/me: validates the bearer token itself (the whole /auth/** prefix is public at
     * the gateway), then returns the same "user" shape as login.
     */
    public UserSummary me(String authorizationHeader) {
        if (isBlank(authorizationHeader) || !authorizationHeader.startsWith("Bearer ")) {
            throw new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }
        String token = authorizationHeader.substring("Bearer ".length()).trim();

        Claims claims;
        try {
            claims = jwtService.parseAndValidate(token);
        } catch (JwtException | IllegalArgumentException e) {
            throw new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "Token is invalid or expired");
        }

        Long userId;
        try {
            userId = Long.valueOf(claims.getSubject());
        } catch (NumberFormatException e) {
            throw new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "Token is invalid or expired");
        }

        Optional<User> userOpt = userMapper.findById(userId);
        if (userOpt.isEmpty()) {
            throw new BusinessException("AUTH_TOKEN_INVALID", HttpStatus.UNAUTHORIZED, "Token is invalid or expired");
        }
        User user = userOpt.get();

        Long patientId = claims.get("patientId", Long.class);
        String patientCode = claims.get("patientCode", String.class);
        Long doctorId = claims.get("doctorId", Long.class);

        return new UserSummary(user.getId(), user.getFullName(), user.getRole(), patientId, patientCode, doctorId);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.charAt(0) + s.substring(1).toLowerCase();
    }
}
