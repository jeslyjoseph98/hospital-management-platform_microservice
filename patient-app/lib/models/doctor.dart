import 'doctor_timing.dart';

/// GET /api/v1/departments/{id}/doctors (SVC-03 §4.1).
class Doctor {
  final int id;
  final String fullName;
  final String qualification;
  final String specialization;
  final int experienceYears;
  final double consultationFee;
  final String? about;
  final List<DoctorTiming> timings;

  Doctor({
    required this.id,
    required this.fullName,
    required this.qualification,
    required this.specialization,
    required this.experienceYears,
    required this.consultationFee,
    this.about,
    required this.timings,
  });

  factory Doctor.fromJson(Map<String, dynamic> json) {
    return Doctor(
      id: json['id'] as int,
      fullName: json['fullName'] as String,
      qualification: json['qualification'] as String,
      specialization: json['specialization'] as String,
      experienceYears: json['experienceYears'] as int,
      consultationFee: (json['consultationFee'] as num).toDouble(),
      about: json['about'] as String?,
      timings: (json['timings'] as List<dynamic>? ?? [])
          .map((t) => DoctorTiming.fromJson(t as Map<String, dynamic>))
          .toList(),
    );
  }
}
