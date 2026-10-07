import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../providers/booking_provider.dart';
import '../../utils/error_presenter.dart';

/// Book — Departments: GET /departments (SVC-07B §6).
class DepartmentsScreen extends StatefulWidget {
  const DepartmentsScreen({super.key});

  @override
  State<DepartmentsScreen> createState() => _DepartmentsScreenState();
}

class _DepartmentsScreenState extends State<DepartmentsScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      await context.read<BookingProvider>().loadDepartments();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (ErrorPresenter.showIfInfra(context, e)) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = context.watch<BookingProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Book Appointment')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: booking.loadingDepartments
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(
                    children: [
                      const SizedBox(height: 120),
                      Center(child: Text(_error!)),
                      const SizedBox(height: 12),
                      Center(
                        child: OutlinedButton(onPressed: _load, child: const Text('Retry')),
                      ),
                    ],
                  )
                : booking.departments.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 120),
                          Center(child: Text('No departments available')),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: booking.departments.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final dept = booking.departments[index];
                          return Card(
                            child: ListTile(
                              leading: const CircleAvatar(child: Icon(Icons.local_hospital)),
                              title: Text(dept.deptName),
                              subtitle: dept.description != null ? Text(dept.description!) : null,
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () async {
                                try {
                                  await context.read<BookingProvider>().selectDepartment(dept);
                                  if (context.mounted) context.push('/book/doctors');
                                } on ApiException catch (e) {
                                  if (context.mounted) ErrorPresenter.showIfInfra(context, e);
                                }
                              },
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
