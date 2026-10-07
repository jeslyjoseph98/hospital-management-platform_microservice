package com.hms.doctor.service;

import com.hms.doctor.client.AppointmentServiceClient;
import com.hms.doctor.client.FutureCount;
import com.hms.doctor.dto.*;
import com.hms.doctor.event.DoctorStatusChangedPayload;
import com.hms.doctor.event.OutboxService;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DoctorAvailabilityMapper;
import com.hms.doctor.mapper.DoctorMapper;
import com.hms.doctor.model.Department;
import com.hms.doctor.model.Doctor;
import com.hms.doctor.model.DoctorAvailability;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DoctorService {

    private final DoctorMapper doctorMapper;
    private final DoctorAvailabilityMapper availabilityMapper;
    private final DepartmentService departmentService;
    private final DoctorValidationService validationService;
    private final AppointmentServiceClient appointmentServiceClient;
    private final OutboxService outboxService;

    public DoctorService(DoctorMapper doctorMapper,
                          DoctorAvailabilityMapper availabilityMapper,
                          DepartmentService departmentService,
                          DoctorValidationService validationService,
                          AppointmentServiceClient appointmentServiceClient,
                          OutboxService outboxService) {
        this.doctorMapper = doctorMapper;
        this.availabilityMapper = availabilityMapper;
        this.departmentService = departmentService;
        this.validationService = validationService;
        this.appointmentServiceClient = appointmentServiceClient;
        this.outboxService = outboxService;
    }

    public Doctor getByIdOrThrow(Long id) {
        Doctor doctor = doctorMapper.findById(id);
        if (doctor == null) {
            throw new BusinessException("DOC_NOT_FOUND", HttpStatus.NOT_FOUND, "Doctor not found");
        }
        return doctor;
    }

    // ---------- Patient-facing reads ----------

    /** DOC-R15: active doctors of active department only. DOC-R16: PII hidden. */
    public List<PatientDoctorResponse> listActiveByDepartment(Long departmentId) {
        departmentService.getActiveOrThrow(departmentId);
        return doctorMapper.findActiveByDepartment(departmentId).stream()
                .map(this::toPatientResponse)
                .collect(Collectors.toList());
    }

    private PatientDoctorResponse toPatientResponse(Doctor d) {
        PatientDoctorResponse r = new PatientDoctorResponse();
        r.setId(d.getId());
        r.setFullName(d.getFullName());
        r.setQualification(d.getQualification());
        r.setSpecialization(d.getSpecialization());
        r.setExperienceYears(d.getExperienceYears());
        r.setConsultationFee(d.getConsultationFee());
        r.setAbout(d.getAbout());
        List<TimingView> timings = availabilityMapper.findByDoctorId(d.getId()).stream()
                .map(a -> new TimingView(
                        com.hms.doctor.util.DayOfWeekUtil.name(a.getDayOfWeek()),
                        a.getStartTime().toString().substring(0, 5),
                        a.getEndTime().toString().substring(0, 5)))
                .collect(Collectors.toList());
        r.setTimings(timings);
        return r;
    }

    // ---------- Admin reads ----------

    public PagedResponse<AdminDoctorResponse> search(Long departmentId, String name, Boolean active, int page, int size) {
        int offset = page * size;
        List<Doctor> doctors = doctorMapper.search(departmentId, name, active, offset, size);
        long total = doctorMapper.countSearch(departmentId, name, active);
        List<AdminDoctorResponse> content = doctors.stream().map(this::toAdminResponse).collect(Collectors.toList());
        return new PagedResponse<>(content, page, size, total);
    }

    public AdminDoctorResponse getAdminDetail(Long id) {
        Doctor doctor = getByIdOrThrow(id);
        return toAdminResponse(doctor);
    }

    private AdminDoctorResponse toAdminResponse(Doctor d) {
        AdminDoctorResponse r = new AdminDoctorResponse();
        r.setId(d.getId());
        r.setDepartmentId(d.getDepartmentId());
        Department dept = null;
        try {
            dept = departmentService.getByIdOrThrow(d.getDepartmentId());
        } catch (BusinessException ignored) {
            // department missing is unexpected but should not break the doctor read
        }
        r.setDepartmentName(dept != null ? dept.getDeptName() : null);
        r.setFullName(d.getFullName());
        r.setQualification(d.getQualification());
        r.setSpecialization(d.getSpecialization());
        r.setRegistrationNumber(d.getRegistrationNumber());
        r.setExperienceYears(d.getExperienceYears());
        r.setPhone(d.getPhone());
        r.setEmail(d.getEmail());
        r.setAbout(d.getAbout());
        r.setConsultationFee(d.getConsultationFee());
        r.setDailyLimit(d.getDailyLimit());
        r.setLoginRegistered(d.isLoginRegistered());
        r.setActive(d.isActive());
        List<AdminTimingView> timings = availabilityMapper.findByDoctorId(d.getId()).stream()
                .map(a -> new AdminTimingView(a.getDayOfWeek(), a.getStartTime(), a.getEndTime()))
                .collect(Collectors.toList());
        r.setTimings(timings);
        return r;
    }

    // ---------- Create ----------

    /** DOC-R1..R5, DOC-R9: create doctor and timings in one transaction. */
    @Transactional
    public Doctor create(DoctorRequest request, Long userId) {
        validationService.validate(request);

        // DOC-R2: department must exist and be active
        departmentService.getActiveOrThrow(request.getDepartmentId());

        // DOC-R3: registration number unique
        if (doctorMapper.findByRegistrationNumber(request.getRegistrationNumber()) != null) {
            throw new BusinessException("ADM_DOCTOR_REG_EXISTS", HttpStatus.CONFLICT,
                    "Registration number '" + request.getRegistrationNumber() + "' already exists");
        }

        Doctor doctor = new Doctor();
        doctor.setDepartmentId(request.getDepartmentId());
        doctor.setFullName(request.getFullName());
        doctor.setQualification(request.getQualification());
        doctor.setSpecialization(request.getSpecialization());
        doctor.setRegistrationNumber(request.getRegistrationNumber());
        doctor.setExperienceYears(request.getExperienceYears() == null ? 0 : request.getExperienceYears());
        doctor.setPhone(request.getPhone());
        doctor.setEmail(request.getEmail());
        doctor.setAbout(request.getAbout());
        doctor.setConsultationFee(request.getConsultationFee());
        // DOC-R5: default 50 when not sent
        doctor.setDailyLimit(request.getDailyLimit() == null ? 50 : request.getDailyLimit());
        doctor.setLoginRegistered(false);
        doctor.setActive(true);
        doctor.setCreatedBy(userId);
        doctor.setUpdatedBy(userId);

        doctorMapper.insert(doctor);

        if (request.getTimings() != null && !request.getTimings().isEmpty()) {
            List<DoctorAvailability> availabilities = toAvailabilityList(doctor.getId(), request.getTimings(), userId);
            WeeklyTimingsValidator.validateStructure(availabilities, doctor.getDailyLimit());
            for (DoctorAvailability a : availabilities) {
                availabilityMapper.insert(a);
            }
        }
        // DOC-R9: a doctor with no timings shows every date as NOT_AVAILABLE - nothing further to do.

        return doctor;
    }

    private List<DoctorAvailability> toAvailabilityList(Long doctorId, List<TimingRequest> timings, Long userId) {
        List<DoctorAvailability> result = new ArrayList<>();
        for (TimingRequest t : timings) {
            DoctorAvailability a = new DoctorAvailability();
            a.setDoctorId(doctorId);
            a.setDayOfWeek(t.getDayOfWeek());
            a.setStartTime(t.getStartTime());
            a.setEndTime(t.getEndTime());
            a.setCreatedBy(userId);
            result.add(a);
        }
        return result;
    }

    // ---------- Update ----------

    /** DOC-R6, DOC-R7, DOC-R8: update profile, fee, daily limit. */
    @Transactional
    public Doctor update(Long id, DoctorRequest request, Long userId) {
        validationService.validate(request);
        Doctor existing = getByIdOrThrow(id);

        // DOC-R2: department must exist and be active (if changed or not, must always be active)
        departmentService.getActiveOrThrow(request.getDepartmentId());

        // DOC-R3: registration number unique (excluding self)
        Doctor dup = doctorMapper.findByRegistrationNumberExcludingId(request.getRegistrationNumber(), id);
        if (dup != null) {
            throw new BusinessException("ADM_DOCTOR_REG_EXISTS", HttpStatus.CONFLICT,
                    "Registration number '" + request.getRegistrationNumber() + "' already exists");
        }

        // DOC-R8: registration number lock once login_registered = 1
        if (existing.isLoginRegistered()
                && !existing.getRegistrationNumber().equals(request.getRegistrationNumber())) {
            throw new BusinessException("ADM_DOCTOR_REG_LOCKED", HttpStatus.CONFLICT,
                    "Registration number cannot be changed once the doctor has logged in");
        }

        int newDailyLimit = request.getDailyLimit() == null ? existing.getDailyLimit() : request.getDailyLimit();

        // DOC-R6: reducing daily_limit requires a safety check against future-counts
        if (newDailyLimit < existing.getDailyLimit()) {
            List<FutureCount> futureCounts = appointmentServiceClient.getFutureCounts(id);
            List<AffectedDate> affected = futureCounts.stream()
                    .filter(fc -> fc.getCount() != null && fc.getCount() > newDailyLimit)
                    .map(fc -> new AffectedDate(fc.getDate(), fc.getCount()))
                    .collect(Collectors.toList());
            if (!affected.isEmpty()) {
                throw new BusinessException("ADM_LIMIT_BELOW_BOOKED", HttpStatus.CONFLICT,
                        "Daily limit cannot be reduced below already-booked counts on some future dates",
                        new AffectedDataWrapper(affected));
            }
        }

        existing.setDepartmentId(request.getDepartmentId());
        existing.setFullName(request.getFullName());
        existing.setQualification(request.getQualification());
        existing.setSpecialization(request.getSpecialization());
        // registration number: keep locked value if locked, else apply requested value (already validated above)
        existing.setRegistrationNumber(request.getRegistrationNumber());
        existing.setExperienceYears(request.getExperienceYears() == null ? existing.getExperienceYears() : request.getExperienceYears());
        existing.setPhone(request.getPhone());
        existing.setEmail(request.getEmail());
        existing.setAbout(request.getAbout());
        existing.setConsultationFee(request.getConsultationFee());
        existing.setDailyLimit(newDailyLimit);
        existing.setUpdatedBy(userId);

        doctorMapper.update(existing);
        return existing;
    }

    // ---------- Activate / deactivate ----------

    /** DOC-R10, DOC-R11: deactivate blocked if future bookings exist; status change + outbox in one transaction. */
    @Transactional
    public Doctor updateStatus(Long id, boolean active, Long userId) {
        Doctor existing = getByIdOrThrow(id);

        if (!active && existing.isActive()) {
            List<FutureCount> futureCounts = appointmentServiceClient.getFutureCounts(id);
            List<AffectedDate> affected = futureCounts.stream()
                    .filter(fc -> fc.getCount() != null && fc.getCount() > 0)
                    .map(fc -> new AffectedDate(fc.getDate(), fc.getCount()))
                    .collect(Collectors.toList());
            if (!affected.isEmpty()) {
                throw new BusinessException("ADM_DOCTOR_HAS_BOOKINGS", HttpStatus.CONFLICT,
                        "Doctor has future bookings and cannot be deactivated",
                        new AffectedDataWrapper(affected));
            }
        }

        doctorMapper.updateStatus(id, active, userId);
        existing.setActive(active);

        // DOC-R11: outbox write in the same transaction as the status change
        outboxService.save("doctor.status-changed", String.valueOf(id), "doctor.status-changed",
                new DoctorStatusChangedPayload(id, active));

        return existing;
    }

    /** Simple wrapper so the API shape is { "data": { "affected": [...] } }. */
    public static class AffectedDataWrapper {
        private final List<AffectedDate> affected;

        public AffectedDataWrapper(List<AffectedDate> affected) {
            this.affected = affected;
        }

        public List<AffectedDate> getAffected() {
            return affected;
        }
    }
}
