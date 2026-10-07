/// One weekly timing window, as embedded in the doctor-list response (SVC-03 §4.1).
class DoctorTiming {
  final String day; // e.g. "MONDAY"
  final String startTime; // "10:00"
  final String endTime; // "13:00"

  DoctorTiming({
    required this.day,
    required this.startTime,
    required this.endTime,
  });

  factory DoctorTiming.fromJson(Map<String, dynamic> json) {
    return DoctorTiming(
      day: json['day'] as String,
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
    );
  }
}
