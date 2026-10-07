import '../models/appointment.dart';
import '../models/availability.dart';
import '../models/booking_result.dart';
import '../models/consultation_summary.dart';
import '../models/department.dart';
import '../models/doctor.dart';
import '../models/notification_item.dart';
import '../models/patient_profile.dart';
import '../models/user.dart';
import 'api_client.dart';
import 'api_exception.dart';

/// All HTTP calls this app makes, grouped by backend service. Every call goes
/// through the gateway base URL configured in [ApiClient] — never directly to
/// a backend service.
class HmsApi {
  HmsApi(this._client);

  final ApiClient _client;

  // ---- user-service (SVC-02) ----

  Future<String> register({
    required String fullName,
    required String phone,
    String? email,
    required String password,
    required String dateOfBirth, // YYYY-MM-DD
    required String gender, // MALE | FEMALE | OTHER
    String? address,
  }) async {
    final result = await _client.post('/auth/register', data: {
      'role': 'PATIENT',
      'fullName': fullName,
      'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      'password': password,
      'dateOfBirth': dateOfBirth,
      'gender': gender,
      if (address != null && address.isNotEmpty) 'address': address,
    });
    return result.value ?? 'Registration successful. Please log in.';
  }

  Future<LoginResult> login({
    required String phone,
    required String password,
  }) async {
    final result = await _client.post('/auth/login', data: {
      'role': 'PATIENT',
      'phone': phone,
      'password': password,
    });
    return LoginResult.fromJson(result.key as Map<String, dynamic>);
  }

  Future<AppUser> me() async {
    final data = await _client.get('/auth/me');
    return AppUser.fromJson(data as Map<String, dynamic>);
  }

  Future<PatientProfile> myProfile() async {
    final data = await _client.get('/patients/me');
    return PatientProfile.fromJson(data as Map<String, dynamic>);
  }

  // ---- doctor-service (SVC-03) ----

  Future<List<Department>> departments() async {
    final data = await _client.get('/departments');
    return (data as List<dynamic>)
        .map((d) => Department.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  Future<List<Doctor>> doctorsInDepartment(int departmentId) async {
    final data = await _client.get('/departments/$departmentId/doctors');
    return (data as List<dynamic>)
        .map((d) => Doctor.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  // ---- appointment-service (SVC-04) ----

  Future<DoctorAvailability> availability(int doctorId) async {
    final data = await _client.get('/doctors/$doctorId/availability');
    return DoctorAvailability.fromJson(data as Map<String, dynamic>);
  }

  Future<BookingResult> book({
    required int doctorId,
    required String appointmentDate,
    String? reason,
  }) async {
    final result = await _client.post('/appointments', data: {
      'doctorId': doctorId,
      'appointmentDate': appointmentDate,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
    return BookingResult.fromJson(result.key as Map<String, dynamic>);
  }

  Future<List<Appointment>> myAppointments({required bool upcoming}) async {
    final data = await _client.get('/appointments/my',
        queryParameters: {'upcoming': upcoming});
    return (data as List<dynamic>)
        .map((a) => Appointment.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  Future<Appointment> appointmentDetail(int appointmentId) async {
    final data = await _client.get('/appointments/$appointmentId');
    return Appointment.fromJson(data as Map<String, dynamic>);
  }

  // ---- consultation-service (SVC-05) ----

  /// Returns null if no completed consultation exists yet for this
  /// appointment (i.e. the visit hasn't happened / wasn't completed).
  Future<ConsultationSummary?> myConsultation(int appointmentId) async {
    try {
      final data = await _client.get('/consultations/my/$appointmentId');
      if (data == null) return null;
      return ConsultationSummary.fromJson(data as Map<String, dynamic>);
    } on ApiException catch (e) {
      // 404 DRC_NOT_FOUND simply means "not completed yet" — not an error
      // the appointment-detail screen needs to surface.
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  // ---- notification-service (SVC-06) ----

  Future<List<NotificationItem>> myNotifications(
      {int page = 0, int size = 20}) async {
    final data = await _client.get('/notifications/my',
        queryParameters: {'page': page, 'size': size});
    return (data as List<dynamic>)
        .map((n) => NotificationItem.fromJson(n as Map<String, dynamic>))
        .toList();
  }

  Future<int> unreadCount() async {
    final data = await _client.get('/notifications/my/unread-count');
    return (data as Map<String, dynamic>)['count'] as int;
  }

  Future<void> markNotificationRead(int id) async {
    await _client.patch('/notifications/$id/read');
  }
}
