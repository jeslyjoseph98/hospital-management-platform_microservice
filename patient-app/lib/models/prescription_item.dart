/// One prescription line item (SVC-05 §2.1 / §7).
class PrescriptionItem {
  final String medicineName;
  final String? strength;
  final String dosagePattern; // e.g. "1-0-1"
  final String timing; // BEFORE_FOOD | AFTER_FOOD | BEDTIME | AS_NEEDED
  final int durationDays;
  final String? instructions;

  PrescriptionItem({
    required this.medicineName,
    this.strength,
    required this.dosagePattern,
    required this.timing,
    required this.durationDays,
    this.instructions,
  });

  factory PrescriptionItem.fromJson(Map<String, dynamic> json) {
    return PrescriptionItem(
      medicineName: json['medicineName'] as String,
      strength: json['strength'] as String?,
      dosagePattern: json['dosagePattern'] as String,
      timing: json['timing'] as String,
      durationDays: json['durationDays'] as int,
      instructions: json['instructions'] as String?,
    );
  }

  /// Human readable timing, e.g. "After food".
  String get timingLabel {
    switch (timing) {
      case 'BEFORE_FOOD':
        return 'Before food';
      case 'AFTER_FOOD':
        return 'After food';
      case 'BEDTIME':
        return 'Bedtime';
      case 'AS_NEEDED':
        return 'As needed';
      default:
        return timing;
    }
  }
}
