import 'prescription_item.dart';

/// GET /api/v1/consultations/my/{appointmentId} (SVC-05 §6, PAT-R1/PAT-R2).
/// Only returned once the consultation is COMPLETED.
class ConsultationSummary {
  final String appointmentDate;
  final String doctorName;
  final String departmentName;
  final String? chiefComplaint;
  final String? diagnosis;
  final String? advice;
  final String? followUpDate;
  final Map<String, dynamic>? vitals;
  final List<PrescriptionItem> prescription;

  /// One of: "Medicines given on {date}" (+ remarks), "Medicines not yet
  /// collected", or null if dispense was NOT_REQUIRED (no items prescribed).
  final String? dispenseMessage;

  ConsultationSummary({
    required this.appointmentDate,
    required this.doctorName,
    required this.departmentName,
    this.chiefComplaint,
    this.diagnosis,
    this.advice,
    this.followUpDate,
    this.vitals,
    required this.prescription,
    this.dispenseMessage,
  });

  factory ConsultationSummary.fromJson(Map<String, dynamic> json) {
    // Build a friendly dispense message if the backend sends structured
    // dispense info instead of a precomposed message string.
    String? dispenseMessage = json['dispenseMessage'] as String?;
    if (dispenseMessage == null && json['dispense'] != null) {
      final dispense = json['dispense'] as Map<String, dynamic>;
      final status = dispense['status'] as String?;
      if (status == 'DISPENSED') {
        final at = dispense['at'] as String? ?? '';
        final remarks = dispense['remarks'] as String?;
        dispenseMessage = 'Medicines given on $at'
            '${remarks != null && remarks.isNotEmpty ? ' ($remarks)' : ''}';
      } else if (status == 'PENDING') {
        dispenseMessage = 'Medicines not yet collected';
      }
    }

    return ConsultationSummary(
      appointmentDate: json['appointmentDate'] as String? ?? '',
      doctorName: json['doctorName'] as String? ?? '',
      departmentName: json['departmentName'] as String? ?? '',
      chiefComplaint: json['chiefComplaint'] as String?,
      diagnosis: json['diagnosis'] as String?,
      advice: json['advice'] as String?,
      followUpDate: json['followUpDate'] as String?,
      vitals: json['vitals'] as Map<String, dynamic>?,
      prescription: (json['prescription'] as List<dynamic>? ?? [])
          .map((p) => PrescriptionItem.fromJson(p as Map<String, dynamic>))
          .toList(),
      dispenseMessage: dispenseMessage,
    );
  }
}
