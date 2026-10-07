/// GET /api/v1/patients/me (SVC-02 §6.3).
class PatientProfile {
  final int patientId;
  final String patientCode;
  final String name;
  final String phone;
  final String? email;
  final String dateOfBirth; // YYYY-MM-DD
  final int age;
  final String gender;
  final String? address;

  PatientProfile({
    required this.patientId,
    required this.patientCode,
    required this.name,
    required this.phone,
    this.email,
    required this.dateOfBirth,
    required this.age,
    required this.gender,
    this.address,
  });

  factory PatientProfile.fromJson(Map<String, dynamic> json) {
    return PatientProfile(
      patientId: json['patientId'] as int,
      patientCode: json['patientCode'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      dateOfBirth: json['dateOfBirth'] as String,
      age: json['age'] as int,
      gender: json['gender'] as String,
      address: json['address'] as String?,
    );
  }
}
