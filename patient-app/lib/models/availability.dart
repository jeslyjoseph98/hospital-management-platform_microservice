/// One date entry inside the availability response (SVC-04 §4).
class AvailabilityDate {
  final String date; // YYYY-MM-DD
  final String day; // "MONDAY"
  final String? startTime;
  final String? endTime;
  final int? booked;
  final int? remaining;
  final String status; // AVAILABLE | FULLY_BOOKED | NOT_AVAILABLE | CLOSED

  AvailabilityDate({
    required this.date,
    required this.day,
    this.startTime,
    this.endTime,
    this.booked,
    this.remaining,
    required this.status,
  });

  bool get isTappable => status == 'AVAILABLE';

  factory AvailabilityDate.fromJson(Map<String, dynamic> json) {
    return AvailabilityDate(
      date: json['date'] as String,
      day: json['day'] as String,
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      booked: json['booked'] as int?,
      remaining: json['remaining'] as int?,
      status: json['status'] as String,
    );
  }
}

/// GET /api/v1/doctors/{id}/availability (SVC-04 §4).
class DoctorAvailability {
  final int doctorId;
  final String doctorName;
  final int dailyLimit;
  final List<AvailabilityDate> dates;

  DoctorAvailability({
    required this.doctorId,
    required this.doctorName,
    required this.dailyLimit,
    required this.dates,
  });

  factory DoctorAvailability.fromJson(Map<String, dynamic> json) {
    return DoctorAvailability(
      doctorId: json['doctorId'] as int,
      doctorName: json['doctorName'] as String,
      dailyLimit: json['dailyLimit'] as int,
      dates: (json['dates'] as List<dynamic>? ?? [])
          .map((d) => AvailabilityDate.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }
}
