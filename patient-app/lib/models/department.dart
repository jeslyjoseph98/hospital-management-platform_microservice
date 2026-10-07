/// GET /api/v1/departments (SVC-03 §4.1).
class Department {
  final int id;
  final String deptName;
  final String? description;

  Department({
    required this.id,
    required this.deptName,
    this.description,
  });

  factory Department.fromJson(Map<String, dynamic> json) {
    return Department(
      id: json['id'] as int,
      deptName: (json['deptName'] ?? json['name'] ?? '') as String,
      description: json['description'] as String?,
    );
  }
}
