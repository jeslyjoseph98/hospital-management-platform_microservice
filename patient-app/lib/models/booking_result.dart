/// POST /api/v1/appointments response data (SVC-04 §5.3).
class BookingResult {
  final int appointmentId;
  final String appointmentCode;
  final int tokenNumber;
  final String reportingTime; // "10:48"
  final String appointmentDate; // YYYY-MM-DD
  final String doctorName;
  final String departmentName;
  final String consultationTimings; // "10:00 - 13:00"
  final String patientName;
  final String patientCode;
  final String status;

  BookingResult({
    required this.appointmentId,
    required this.appointmentCode,
    required this.tokenNumber,
    required this.reportingTime,
    required this.appointmentDate,
    required this.doctorName,
    required this.departmentName,
    required this.consultationTimings,
    required this.patientName,
    required this.patientCode,
    required this.status,
  });

  factory BookingResult.fromJson(Map<String, dynamic> json) {
    return BookingResult(
      appointmentId: json['appointmentId'] as int,
      appointmentCode: json['appointmentCode'] as String,
      tokenNumber: json['tokenNumber'] as int,
      reportingTime: json['reportingTime'] as String,
      appointmentDate: json['appointmentDate'] as String,
      doctorName: json['doctorName'] as String,
      departmentName: json['departmentName'] as String,
      consultationTimings: json['consultationTimings'] as String,
      patientName: json['patientName'] as String,
      patientCode: json['patientCode'] as String,
      status: json['status'] as String,
    );
  }
}
