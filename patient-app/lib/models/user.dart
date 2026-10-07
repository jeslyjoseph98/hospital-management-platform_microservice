/// Logged-in user, as returned by /auth/login and /auth/me (SVC-02 §6.2).
class AppUser {
  final int id;
  final String name;
  final String role;
  final int? patientId;
  final String? patientCode;
  final int? doctorId;

  AppUser({
    required this.id,
    required this.name,
    required this.role,
    this.patientId,
    this.patientCode,
    this.doctorId,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as int,
      name: json['name'] as String,
      role: json['role'] as String,
      patientId: json['patientId'] as int?,
      patientCode: json['patientCode'] as String?,
      doctorId: json['doctorId'] as int?,
    );
  }
}

/// Login response data: { accessToken, expiresIn, user }.
class LoginResult {
  final String accessToken;
  final int expiresIn;
  final AppUser user;

  LoginResult({
    required this.accessToken,
    required this.expiresIn,
    required this.user,
  });

  factory LoginResult.fromJson(Map<String, dynamic> json) {
    return LoginResult(
      accessToken: json['accessToken'] as String,
      expiresIn: json['expiresIn'] as int,
      user: AppUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}
