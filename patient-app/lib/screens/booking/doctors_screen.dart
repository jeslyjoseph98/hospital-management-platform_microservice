import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../models/doctor.dart';
import '../../providers/booking_provider.dart';
import '../../utils/error_presenter.dart';

/// Book — Doctors: GET /departments/{id}/doctors (SVC-07B §6). Doctor cards
/// show name, qualification, specialization, experience, fee, weekly
/// timings.
class DoctorsScreen extends StatelessWidget {
  const DoctorsScreen({super.key});

  String _timingsLabel(Doctor doctor) {
    if (doctor.timings.isEmpty) return 'No fixed timings';
    return doctor.timings
        .map((t) => '${_dayLabel(t.day)} ${t.startTime}-${t.endTime}')
        .join(' • ');
  }

  String _dayLabel(String day) {
    const map = {
      'MONDAY': 'Mon',
      'TUESDAY': 'Tue',
      'WEDNESDAY': 'Wed',
      'THURSDAY': 'Thu',
      'FRIDAY': 'Fri',
      'SATURDAY': 'Sat',
      'SUNDAY': 'Sun',
    };
    return map[day] ?? day;
  }

  @override
  Widget build(BuildContext context) {
    final booking = context.watch<BookingProvider>();
    final deptName = booking.selectedDepartment?.deptName ?? 'Doctors';

    return Scaffold(
      appBar: AppBar(title: Text(deptName)),
      body: booking.loadingDoctors
          ? const Center(child: CircularProgressIndicator())
          : booking.doctors.isEmpty
              ? const Center(child: Text('No doctors available in this department'))
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: booking.doctors.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final doctor = booking.doctors[index];
                    return Card(
                      child: InkWell(
                        onTap: () async {
                          try {
                            await context.read<BookingProvider>().selectDoctor(doctor);
                            if (context.mounted) context.push('/book/date');
                          } on ApiException catch (e) {
                            if (context.mounted) ErrorPresenter.showIfInfra(context, e);
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(doctor.fullName, style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 4),
                              Text('${doctor.qualification} • ${doctor.specialization}'),
                              const SizedBox(height: 4),
                              Text('${doctor.experienceYears} yrs experience • Fee: ₹${doctor.consultationFee.toStringAsFixed(0)}'),
                              if (doctor.about != null && doctor.about!.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  doctor.about!,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                              const SizedBox(height: 8),
                              Text(
                                _timingsLabel(doctor),
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF7C3AED)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
