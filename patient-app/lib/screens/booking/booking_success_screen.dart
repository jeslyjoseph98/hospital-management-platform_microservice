import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/booking_result.dart';
import '../../providers/booking_provider.dart';
import '../../utils/formatters.dart';

/// Booking Success: large token number, reporting time, doctor, department,
/// date, appointment code (SVC-07B §6).
class BookingSuccessScreen extends StatelessWidget {
  const BookingSuccessScreen({super.key, required this.result});

  final BookingResult result;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Booking Confirmed'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle, size: 72, color: Colors.green.shade600),
                const SizedBox(height: 16),
                Text('Token Number', style: Theme.of(context).textTheme.titleMedium),
                Text(
                  '${result.tokenNumber}',
                  style: Theme.of(context).textTheme.displayLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF7C3AED),
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Please report by ${Formatters.time(result.reportingTime)}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _row('Doctor', result.doctorName),
                        _row('Department', result.departmentName),
                        _row('Date', Formatters.date(result.appointmentDate)),
                        _row('Appointment code', result.appointmentCode),
                        _row('Patient', '${result.patientName} (${result.patientCode})'),
                        _row('Status', result.status),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      context.read<BookingProvider>().resetFlow();
                      context.go('/appointments');
                    },
                    child: const Text('View My Appointments'),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () {
                      context.read<BookingProvider>().resetFlow();
                      context.go('/book');
                    },
                    child: const Text('Book Another Appointment'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
