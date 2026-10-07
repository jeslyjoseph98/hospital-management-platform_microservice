import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/hms_api.dart';
import '../../models/appointment.dart';
import '../../models/consultation_summary.dart';
import '../../utils/error_presenter.dart';
import '../../utils/formatters.dart';

/// Appointment Detail / booking slip. If COMPLETED, also shows diagnosis,
/// advice, follow-up date, prescription list, and dispense status
/// (SVC-07B §6). GET /appointments/{id}, GET /consultations/my/{id}.
class AppointmentDetailScreen extends StatefulWidget {
  const AppointmentDetailScreen({super.key, required this.api, required this.appointmentId});

  final HmsApi api;
  final int appointmentId;

  @override
  State<AppointmentDetailScreen> createState() => _AppointmentDetailScreenState();
}

class _AppointmentDetailScreenState extends State<AppointmentDetailScreen> {
  Appointment? _appointment;
  ConsultationSummary? _consultation;
  bool _loading = true;
  String? _error;

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
      final appointment = await widget.api.appointmentDetail(widget.appointmentId);
      ConsultationSummary? consultation;
      if (appointment.isCompleted) {
        consultation = await widget.api.myConsultation(widget.appointmentId);
      }
      if (!mounted) return;
      setState(() {
        _appointment = appointment;
        _consultation = consultation;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Appointment Detail')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _appointment == null
                  ? const SizedBox.shrink()
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildSlip(context, _appointment!),
                          if (_appointment!.isCompleted) ...[
                            const SizedBox(height: 16),
                            if (_consultation != null)
                              _buildConsultation(context, _consultation!)
                            else
                              const Card(
                                child: Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text('Consultation summary not available yet.'),
                                ),
                              ),
                          ],
                        ],
                      ),
                    ),
    );
  }

  Widget _buildSlip(BuildContext context, Appointment apt) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Booking Slip', style: Theme.of(context).textTheme.titleMedium),
            const Divider(),
            _row('Appointment code', apt.appointmentCode),
            _row('Doctor', apt.doctorName),
            _row('Department', apt.departmentName),
            _row('Date', Formatters.date(apt.appointmentDate)),
            _row('Token number', '${apt.tokenNumber}'),
            _row('Reporting time', Formatters.time(apt.reportingTime)),
            if (apt.reason != null && apt.reason!.isNotEmpty) _row('Reason', apt.reason!),
            _row('Status', apt.status),
          ],
        ),
      ),
    );
  }

  Widget _buildConsultation(BuildContext context, ConsultationSummary c) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Consultation Summary', style: Theme.of(context).textTheme.titleMedium),
            const Divider(),
            if (c.diagnosis != null) _row('Diagnosis', c.diagnosis!),
            if (c.advice != null) _row('Advice', c.advice!),
            if (c.followUpDate != null) _row('Follow-up date', Formatters.date(c.followUpDate!)),
            if (c.prescription.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Prescription', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              ...c.prescription.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${item.medicineName}${item.strength != null ? ' (${item.strength})' : ''}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text('${item.dosagePattern} • ${item.timingLabel} • ${item.durationDays} days'),
                        if (item.instructions != null && item.instructions!.isNotEmpty)
                          Text(item.instructions!, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  )),
            ],
            if (c.dispenseMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                c.dispenseMessage!,
                style: TextStyle(
                  fontStyle: FontStyle.italic,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54)),
          const SizedBox(width: 12),
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
