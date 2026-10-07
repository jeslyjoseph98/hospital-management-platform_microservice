import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../models/availability.dart';
import '../../providers/booking_provider.dart';
import '../../utils/error_presenter.dart';
import '../../utils/formatters.dart';

/// Book — Date: horizontal 7-day strip + reason field + Confirm Booking
/// (SVC-07B §6). GET /doctors/{id}/availability, POST /appointments.
class DateAvailabilityScreen extends StatefulWidget {
  const DateAvailabilityScreen({super.key});

  @override
  State<DateAvailabilityScreen> createState() => _DateAvailabilityScreenState();
}

class _DateAvailabilityScreenState extends State<DateAvailabilityScreen> {
  final _reasonCtrl = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  String _statusLabel(AvailabilityDate date) {
    switch (date.status) {
      case 'AVAILABLE':
        return '${date.remaining} left';
      case 'FULLY_BOOKED':
        return 'Fully booked';
      case 'NOT_AVAILABLE':
        return 'Not available';
      case 'CLOSED':
        return 'Closed';
      default:
        return date.status;
    }
  }

  Color _chipColor(BuildContext context, AvailabilityDate date, bool selected) {
    if (selected) return Theme.of(context).colorScheme.primary;
    switch (date.status) {
      case 'AVAILABLE':
        return const Color(0xFFF5F3FF);
      default:
        return Colors.grey.shade200;
    }
  }

  Future<void> _confirmBooking() async {
    final booking = context.read<BookingProvider>();
    if (booking.selectedDate == null) return;

    setState(() => _error = null);
    try {
      final result = await booking.confirmBooking(
        reason: _reasonCtrl.text.trim().isEmpty ? null : _reasonCtrl.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Booking successful'), backgroundColor: Colors.green.shade600),
      );
      context.push('/book/success', extra: result);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (ErrorPresenter.showIfInfra(context, e)) return;
      if (e.isConflict) {
        // 409 APT_DOCTOR_FULLY_BOOKED / APT_ALREADY_BOOKED / APT_BOOKING_CLOSED
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Unable to book'),
            content: Text(e.message),
            actions: [
              TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK')),
            ],
          ),
        );
        if (mounted) await context.read<BookingProvider>().reloadAvailability();
      } else {
        setState(() => _error = e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = context.watch<BookingProvider>();
    final doctor = booking.selectedDoctor;

    return Scaffold(
      appBar: AppBar(title: Text(doctor?.fullName ?? 'Choose date')),
      body: booking.loadingAvailability
          ? const Center(child: CircularProgressIndicator())
          : booking.availability == null
              ? const Center(child: Text('No availability data'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Select a date', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 92,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: booking.availability!.dates.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            final date = booking.availability!.dates[index];
                            final selected = booking.selectedDate?.date == date.date;
                            return GestureDetector(
                              onTap: date.isTappable
                                  ? () => context.read<BookingProvider>().pickDate(date)
                                  : null,
                              child: Opacity(
                                opacity: date.isTappable ? 1.0 : 0.5,
                                child: Container(
                                  width: 84,
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: _chipColor(context, date, selected),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: selected ? Theme.of(context).colorScheme.primary : Colors.grey.shade300,
                                    ),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        Formatters.weekdayShort(date.date),
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: selected ? Colors.white : Colors.black87,
                                        ),
                                      ),
                                      Text(
                                        Formatters.dayOfMonth(date.date),
                                        style: TextStyle(
                                          fontSize: 18,
                                          color: selected ? Colors.white : Colors.black87,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _statusLabel(date),
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: selected ? Colors.white : Colors.black54,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (booking.selectedDate != null) ...[
                        Text(
                          'Selected: ${Formatters.date(booking.selectedDate!.date)}'
                          '${booking.selectedDate!.startTime != null ? ' (${booking.selectedDate!.startTime}-${booking.selectedDate!.endTime})' : ''}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _reasonCtrl,
                          maxLength: 300,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Reason (optional)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                          ),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            // PA-R7: disable while in flight to prevent double booking taps.
                            onPressed: booking.booking ? null : _confirmBooking,
                            child: booking.booking
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Confirm Booking'),
                          ),
                        ),
                      ] else
                        const Text('Tap an available date above to continue.'),
                    ],
                  ),
                ),
    );
  }
}
