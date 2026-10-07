package com.hms.userservice.service;

import com.hms.userservice.client.DoctorServiceClient;
import com.hms.userservice.client.DoctorVerificationResult;
import com.hms.userservice.config.HmsProperties;
import com.hms.userservice.domain.Patient;
import com.hms.userservice.domain.User;
import com.hms.userservice.dto.FieldError;
import com.hms.userservice.dto.RegisterRequest;
import com.hms.userservice.dto.RegisterResponse;
import com.hms.userservice.event.DoctorAccountRegisteredPayload;
import com.hms.userservice.event.OutboxEventWriter;
import com.hms.userservice.exception.BusinessException;
import com.hms.userservice.exception.ValidationFailedException;
import com.hms.userservice.mapper.PatientMapper;
import com.hms.userservice.mapper.UserMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Implements SVC-02 section 4 (REG-R1..REG-R14).
 */
@Service
public class RegistrationService {

    private static final Set<String> VALID_ROLES = Set.of("PATIENT", "DOCTOR", "PHARMACIST", "ADMIN");
    private static final Set<String> VALID_GENDERS = Set.of("MALE", "FEMALE", "OTHER");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^[6-9][0-9]{9}$");
    private static final Pattern PASSWORD_LETTER = Pattern.compile("[A-Za-z]");
    private static final Pattern PASSWORD_DIGIT = Pattern.compile("[0-9]");

    private final UserMapper userMapper;
    private final PatientMapper patientMapper;
    private final PasswordEncoder passwordEncoder;
    private final HmsProperties hmsProperties;
    private final DoctorServiceClient doctorServiceClient;
    private final OutboxEventWriter outboxEventWriter;

    public RegistrationService(UserMapper userMapper,
                                PatientMapper patientMapper,
                                PasswordEncoder passwordEncoder,
                                HmsProperties hmsProperties,
                                DoctorServiceClient doctorServiceClient,
                                OutboxEventWriter outboxEventWriter) {
        this.userMapper = userMapper;
        this.patientMapper = patientMapper;
        this.passwordEncoder = passwordEncoder;
        this.hmsProperties = hmsProperties;
        this.doctorServiceClient = doctorServiceClient;
        this.outboxEventWriter = outboxEventWriter;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest req) {
        // REG-R1
        String role = req.getRole();
        if (role == null || !VALID_ROLES.contains(role)) {
            throw new BusinessException("REG_INVALID_ROLE", HttpStatus.BAD_REQUEST, "role must be one of PATIENT, DOCTOR, PHARMACIST, ADMIN");
        }

        // REG-R2: fullName, phone, password required
        List<FieldError> fieldErrors = new ArrayList<>();
        if (isBlank(req.getFullName())) {
            fieldErrors.add(new FieldError("fullName", "Full name is required"));
        }
        if (isBlank(req.getPhone())) {
            fieldErrors.add(new FieldError("phone", "Phone is required"));
        }
        if (isBlank(req.getPassword())) {
            fieldErrors.add(new FieldError("password", "Password is required"));
        }
        if ("DOCTOR".equals(role) && isBlank(req.getRegistrationNumber())) {
            fieldErrors.add(new FieldError("registrationNumber", "Registration number is required"));
        }
        if (!fieldErrors.isEmpty()) {
            throw new ValidationFailedException(fieldErrors);
        }

        // REG-R3: phone format
        if (!PHONE_PATTERN.matcher(req.getPhone()).matches()) {
            throw new BusinessException("REG_PHONE_INVALID", HttpStatus.BAD_REQUEST,
                    "Phone must be 10 digits starting with 6-9");
        }

        // REG-R4: phone uniqueness
        if (userMapper.findByPhone(req.getPhone()).isPresent()) {
            throw new BusinessException("REG_PHONE_EXISTS", HttpStatus.CONFLICT, "Phone is already registered");
        }

        // REG-R5: email uniqueness (if given)
        if (!isBlank(req.getEmail()) && userMapper.existsByEmail(req.getEmail())) {
            throw new BusinessException("REG_EMAIL_EXISTS", HttpStatus.CONFLICT, "Email is already registered");
        }

        // REG-R6: password strength
        validatePassword(req.getPassword());

        // Role-specific validation
        if ("PATIENT".equals(role)) {
            validatePatientFields(req);
        } else if ("ADMIN".equals(role)) {
            if (req.getAdminCode() == null || !req.getAdminCode().equals(hmsProperties.getAdminRegistrationCode())) {
                throw new BusinessException("REG_ADMIN_CODE_INVALID", HttpStatus.BAD_REQUEST, "Admin code is invalid");
            }
        } else if ("PHARMACIST".equals(role)) {
            if (req.getStaffCode() == null || !req.getStaffCode().equals(hmsProperties.getPharmacyRegistrationCode())) {
                throw new BusinessException("REG_STAFF_CODE_INVALID", HttpStatus.BAD_REQUEST, "Staff code is invalid");
            }
        }

        Long doctorId = null;
        if ("DOCTOR".equals(role)) {
            doctorId = verifyDoctorRegistration(req);
        }

        User user = new User();
        user.setFullName(req.getFullName());
        user.setPhone(req.getPhone());
        user.setEmail(isBlank(req.getEmail()) ? null : req.getEmail());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setRole(role);
        user.setDoctorId(doctorId);

        try {
            userMapper.insert(user);
        } catch (DataIntegrityViolationException e) {
            throw mapUniqueViolation(e, role);
        }

        String patientCode = null;
        if ("PATIENT".equals(role)) {
            Patient patient = new Patient();
            patient.setUserId(user.getId());
            patient.setDateOfBirth(req.getDateOfBirth());
            patient.setGender(req.getGender());
            patient.setAddress(req.getAddress());
            patientMapper.insert(patient);
            patientCode = "PAT" + String.format("%06d", patient.getId());
            patientMapper.updatePatientCode(patient.getId(), patientCode);
        } else if ("DOCTOR".equals(role)) {
            outboxEventWriter.write("user.doctor-account-registered", String.valueOf(doctorId),
                    new DoctorAccountRegisteredPayload(user.getId(), doctorId));
        }

        return new RegisterResponse(user.getId(), role, patientCode);
    }

    private Long verifyDoctorRegistration(RegisterRequest req) {
        DoctorVerificationResult result = doctorServiceClient.verifyRegistration(req.getRegistrationNumber(), req.getPhone());
        switch (result.getStatus()) {
            case NOT_FOUND:
                throw new BusinessException("REG_DOCTOR_NOT_FOUND", HttpStatus.NOT_FOUND,
                        "Ask the admin to add your profile first");
            case PHONE_MISMATCH:
                throw new BusinessException("REG_DOCTOR_PHONE_MISMATCH", HttpStatus.CONFLICT,
                        "Phone does not match the profile the admin created");
            case INACTIVE:
                throw new BusinessException("REG_DOCTOR_NOT_FOUND", HttpStatus.NOT_FOUND,
                        "Ask the admin to add your profile first");
            case FOUND:
            default:
                break;
        }

        Long doctorId = result.getDoctorId();
        // REG-R12
        if (userMapper.findByDoctorId(doctorId).isPresent()) {
            throw new BusinessException("REG_DOCTOR_ALREADY_REGISTERED", HttpStatus.CONFLICT,
                    "This doctor profile already has a login");
        }
        return doctorId;
    }

    private void validatePatientFields(RegisterRequest req) {
        List<FieldError> fieldErrors = new ArrayList<>();
        if (req.getDateOfBirth() == null) {
            fieldErrors.add(new FieldError("dateOfBirth", "Date of birth is required"));
        }
        if (isBlank(req.getGender())) {
            fieldErrors.add(new FieldError("gender", "Gender is required"));
        }
        if (!fieldErrors.isEmpty()) {
            throw new ValidationFailedException(fieldErrors);
        }
        if (!VALID_GENDERS.contains(req.getGender())) {
            throw new BusinessException("REG_DOB_INVALID", HttpStatus.BAD_REQUEST, "Gender must be MALE, FEMALE or OTHER");
        }
        if (req.getDateOfBirth().isAfter(LocalDate.now())) {
            throw new BusinessException("REG_DOB_INVALID", HttpStatus.BAD_REQUEST, "Date of birth cannot be in the future");
        }
    }

    private void validatePassword(String password) {
        if (password.length() < 8
                || !PASSWORD_LETTER.matcher(password).find()
                || !PASSWORD_DIGIT.matcher(password).find()) {
            throw new BusinessException("REG_WEAK_PASSWORD", HttpStatus.BAD_REQUEST,
                    "Password must be at least 8 characters with a letter and a digit");
        }
    }

    private BusinessException mapUniqueViolation(DataIntegrityViolationException e, String role) {
        String msg = e.getMostSpecificCause() == null ? "" : e.getMostSpecificCause().getMessage();
        String lower = msg == null ? "" : msg.toLowerCase();
        if (lower.contains("phone")) {
            return new BusinessException("REG_PHONE_EXISTS", HttpStatus.CONFLICT, "Phone is already registered");
        }
        if (lower.contains("email")) {
            return new BusinessException("REG_EMAIL_EXISTS", HttpStatus.CONFLICT, "Email is already registered");
        }
        if (lower.contains("doctor_id") && "DOCTOR".equals(role)) {
            return new BusinessException("REG_DOCTOR_ALREADY_REGISTERED", HttpStatus.CONFLICT,
                    "This doctor profile already has a login");
        }
        return new BusinessException("VALIDATION_FAILED", HttpStatus.BAD_REQUEST, "Could not register: duplicate value");
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
