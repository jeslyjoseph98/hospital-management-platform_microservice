/// An appointment as returned by GET /api/v1/appointments/my and
/// GET /api/v1/appointments/{id} (SVC-04 §8). Field names follow the
/// appointments table (SVC-04 §2) converted to camelCase per the platform
/// JSON convention (SVC-00 §5).
class Appointment {
  final int appointmentId;
  final String appointmentCode;
  final String appointmentDate; // YYYY-MM-DD
  final int tokenNumber;
  final String reportingTime; // "10:48" or "10:48:00"
  final String? reason;
  final String status; // BOOKED | COMPLETED
  final String doctorName;
  final String departmentName;
  final String patientName;
  final String patientCode;
  final String? consultationStart;
  final String? consultationEnd;

  Appointment({
    required this.appointmentId,
    required this.appointmentCode,
    required this.appointmentDate,
    required this.tokenNumber,
    required this.reportingTime,
    this.reason,
    required this.status,
    required this.doctorName,
    required this.departmentName,
    required this.patientName,
    required this.patientCode,
    this.consultationStart,
    this.consultationEnd,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      appointmentId:
          (json['appointmentId'] ?? json['id']) as int,
      appointmentCode: json['appointmentCode'] as String,
      appointmentDate: json['appointmentDate'] as String,
      tokenNumber: json['tokenNumber'] as int,
      reportingTime: json['reportingTime'] as String,
      reason: json['reason'] as String?,
      status: json['status'] as String,
      doctorName: json['doctorName'] as String,
      departmentName: json['departmentName'] as String,
      patientName: json['patientName'] as String? ?? '',
      patientCode: json['patientCode'] as String? ?? '',
      consultationStart: json['consultationStart'] as String?,
      consultationEnd: json['consultationEnd'] as String?,
    );
  }

  bool get isCompleted => status == 'COMPLETED';
}
