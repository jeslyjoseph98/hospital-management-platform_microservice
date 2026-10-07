import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/api_exception.dart';
import '../../api/hms_api.dart';
import '../../models/appointment.dart';
import '../../utils/error_presenter.dart';
import '../../utils/formatters.dart';

/// My Appointments: tabs Upcoming / Past (SVC-07B §6).
/// GET /appointments/my?upcoming=true/false
class MyAppointmentsScreen extends StatefulWidget {
  const MyAppointmentsScreen({super.key, required this.api});

  final HmsApi api;

  @override
  State<MyAppointmentsScreen> createState() => _MyAppointmentsScreenState();
}

class _MyAppointmentsScreenState extends State<MyAppointmentsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Appointments'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Upcoming'),
            Tab(text: 'Past'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _AppointmentList(api: widget.api, upcoming: true),
          _AppointmentList(api: widget.api, upcoming: false),
        ],
      ),
    );
  }
}

class _AppointmentList extends StatefulWidget {
  const _AppointmentList({required this.api, required this.upcoming});

  final HmsApi api;
  final bool upcoming;

  @override
  State<_AppointmentList> createState() => _AppointmentListState();
}

class _AppointmentListState extends State<_AppointmentList>
    with AutomaticKeepAliveClientMixin {
  List<Appointment> _appointments = [];
  bool _loading = true;
  String? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await widget.api.myAppointments(upcoming: widget.upcoming);
      if (!mounted) return;
      setState(() {
        _appointments = list;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (ErrorPresenter.showIfInfra(context, e)) {
        setState(() => _loading = false);
        return;
      }
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_appointments.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(child: Text(widget.upcoming ? 'No upcoming appointments' : 'No past appointments')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _appointments.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final apt = _appointments[index];
          return Card(
            child: ListTile(
              title: Text(apt.doctorName),
              subtitle: Text('${apt.departmentName} • ${Formatters.date(apt.appointmentDate)}'),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Token ${apt.tokenNumber}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(
                    apt.status,
                    style: TextStyle(
                      fontSize: 12,
                      color: apt.isCompleted ? Colors.green.shade700 : Colors.orange.shade800,
                    ),
                  ),
                ],
              ),
              onTap: () => context.push('/appointments/${apt.appointmentId}'),
            ),
          );
        },
      ),
    );
  }
}
