package com.hms.gateway.routing;

import com.hms.gateway.security.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RouteTableTest {

    private final RouteTable routeTable = new RouteTable();

    @Test
    void authRouteIsPublic() {
        RouteRule rule = routeTable.match("/api/v1/auth/login").orElseThrow();
        assertThat(rule.isPublic()).isTrue();
    }

    @Test
    void patientsMeRequiresPatientRole() {
        RouteRule rule = routeTable.match("/api/v1/patients/me").orElseThrow();
        assertThat(rule.requiredRole()).isEqualTo(Role.PATIENT);
    }

    @Test
    void doctorAvailabilityIsMatchedBeforeGeneralDoctorsRule() {
        RouteRule rule = routeTable.match("/api/v1/doctors/42/availability").orElseThrow();
        assertThat(rule.pathPattern()).isEqualTo("/api/v1/doctors/*/availability");
        assertThat(rule.requiredRole()).isEqualTo(Role.PATIENT);
    }

    @Test
    void generalDoctorsRouteMatchesOtherDoctorPaths() {
        RouteRule rule = routeTable.match("/api/v1/doctors/42").orElseThrow();
        assertThat(rule.pathPattern()).isEqualTo("/api/v1/doctors/**");
    }

    @Test
    void adminAppointmentsIsMatchedBeforeGeneralAdminRule() {
        RouteRule rule = routeTable.match("/api/v1/admin/appointments/99").orElseThrow();
        assertThat(rule.pathPattern()).isEqualTo("/api/v1/admin/appointments/**");
        assertThat(rule.requiredRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    void generalAdminRouteMatchesOtherAdminPaths() {
        RouteRule rule = routeTable.match("/api/v1/admin/departments").orElseThrow();
        assertThat(rule.pathPattern()).isEqualTo("/api/v1/admin/**");
    }

    @Test
    void doctorAppointmentsIsMatchedBeforeGeneralDoctorRule() {
        RouteRule rule = routeTable.match("/api/v1/doctor/appointments/today").orElseThrow();
        assertThat(rule.pathPattern()).isEqualTo("/api/v1/doctor/appointments/**");
        assertThat(rule.requiredRole()).isEqualTo(Role.DOCTOR);
    }

    @Test
    void generalDoctorRouteMatchesOtherDoctorStaffPaths() {
        RouteRule rule = routeTable.match("/api/v1/doctor/consultations/7").orElseThrow();
        assertThat(rule.pathPattern()).isEqualTo("/api/v1/doctor/**");
    }

    @Test
    void pharmacyRequiresPharmacistRole() {
        RouteRule rule = routeTable.match("/api/v1/pharmacy/prescriptions").orElseThrow();
        assertThat(rule.requiredRole()).isEqualTo(Role.PHARMACIST);
    }

    @Test
    void internalPathsDoNotMatchAnyRoute() {
        assertThat(routeTable.match("/internal/patients/1")).isEmpty();
    }

    @Test
    void unknownPathDoesNotMatchAnyRoute() {
        assertThat(routeTable.match("/api/v1/does-not-exist")).isEmpty();
    }
}
