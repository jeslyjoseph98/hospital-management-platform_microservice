import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/notification_item.dart';
import '../../providers/notification_provider.dart';
import '../../utils/formatters.dart';

/// Notifications: list newest first; unread in bold; tap -> mark read and
/// open the appointment (SVC-07B §6).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  Future<void> _onTap(NotificationItem item) async {
    final provider = context.read<NotificationProvider>();
    await provider.markRead(item);
    if (item.appointmentId != null && mounted) {
      context.push('/appointments/${item.appointmentId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : provider.items.isEmpty
              ? RefreshIndicator(
                  onRefresh: provider.loadNotifications,
                  child: ListView(
                    children: const [
                      SizedBox(height: 120),
                      Center(child: Text('No notifications yet')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: provider.loadNotifications,
                  child: ListView.separated(
                    itemCount: provider.items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = provider.items[index];
                      return ListTile(
                        leading: Icon(
                          item.isRead ? Icons.notifications_none : Icons.notifications_active,
                          color: item.isRead ? Colors.grey : const Color(0xFF7C3AED),
                        ),
                        title: Text(
                          item.title,
                          style: TextStyle(
                            fontWeight: item.isRead ? FontWeight.normal : FontWeight.bold,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.message,
                              style: TextStyle(
                                fontWeight: item.isRead ? FontWeight.normal : FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              Formatters.dateTime(item.createdAt),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                        isThreeLine: true,
                        onTap: () => _onTap(item),
                      );
                    },
                  ),
                ),
    );
  }
}
