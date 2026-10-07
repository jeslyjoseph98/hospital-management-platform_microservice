/// GET /api/v1/notifications/my (SVC-06 §5).
class NotificationItem {
  final int id;
  final String title;
  final String message;
  final int? appointmentId;
  final bool isRead;
  final String createdAt; // ISO timestamp

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    this.appointmentId,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as int,
      title: json['title'] as String,
      message: json['message'] as String,
      appointmentId: json['appointmentId'] as int?,
      isRead: (json['isRead'] ?? json['is_read'] ?? false) as bool,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  NotificationItem copyWith({bool? isRead}) {
    return NotificationItem(
      id: id,
      title: title,
      message: message,
      appointmentId: appointmentId,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}
