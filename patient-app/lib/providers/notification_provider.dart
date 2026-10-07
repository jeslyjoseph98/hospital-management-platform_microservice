import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../api/hms_api.dart';
import '../models/notification_item.dart';

/// Owns the notifications list and the unread-count badge. Polls the unread
/// count on launch, on foreground resume, and every 30 seconds while the app
/// is open (SVC-07B §5), by observing app lifecycle state itself.
class NotificationProvider extends ChangeNotifier with WidgetsBindingObserver {
  NotificationProvider(this._api);

  final HmsApi _api;

  int unreadCount = 0;
  List<NotificationItem> items = [];
  bool loading = false;

  Timer? _pollTimer;
  bool _started = false;

  /// Call once after login / session restore succeeds.
  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    refreshUnreadCount();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      refreshUnreadCount();
    });
  }

  /// Call on logout so polling stops and state is cleared for the next user.
  void stop() {
    _started = false;
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _pollTimer = null;
    unreadCount = 0;
    items = [];
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refreshUnreadCount();
    }
  }

  Future<void> refreshUnreadCount() async {
    try {
      unreadCount = await _api.unreadCount();
      notifyListeners();
    } catch (_) {
      // Silent: badge polling should never surface errors to the user.
    }
  }

  Future<void> loadNotifications() async {
    loading = true;
    notifyListeners();
    try {
      items = await _api.myNotifications();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> markRead(NotificationItem item) async {
    if (item.isRead) return;
    await _api.markNotificationRead(item.id);
    final index = items.indexWhere((n) => n.id == item.id);
    if (index != -1) {
      items[index] = items[index].copyWith(isRead: true);
    }
    if (unreadCount > 0) unreadCount -= 1;
    notifyListeners();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }
}
