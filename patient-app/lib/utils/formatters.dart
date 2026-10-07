import 'package:intl/intl.dart';

/// Centralized date/time formatting per PA-R8: dates dd-MM-yyyy, times
/// hh:mm AM/PM.
class Formatters {
  Formatters._();

  static final DateFormat _dateFmt = DateFormat('dd-MM-yyyy');
  static final DateFormat _timeFmt = DateFormat('hh:mm a');
  static final DateFormat _isoDateFmt = DateFormat('yyyy-MM-dd');
  // Backend times may arrive as "HH:mm" or "HH:mm:ss".
  static final DateFormat _hhmm = DateFormat('HH:mm');
  static final DateFormat _hhmmss = DateFormat('HH:mm:ss');

  /// Formats an ISO date string ("2026-09-28") as "28-09-2026".
  static String date(String isoDate) {
    try {
      final parsed = _isoDateFmt.parse(isoDate);
      return _dateFmt.format(parsed);
    } catch (_) {
      return isoDate;
    }
  }

  /// Formats a 24h time string ("10:48" or "10:48:00") as "10:48 AM".
  static String time(String raw) {
    try {
      final parsed = raw.length <= 5 ? _hhmm.parse(raw) : _hhmmss.parse(raw);
      return _timeFmt.format(parsed);
    } catch (_) {
      return raw;
    }
  }

  /// Formats an ISO-8601 timestamp (with date and time) as "28-09-2026,
  /// 10:48 AM" — used for notification timestamps.
  static String dateTime(String isoTimestamp) {
    try {
      final parsed = DateTime.parse(isoTimestamp).toLocal();
      return '${_dateFmt.format(parsed)}, ${_timeFmt.format(parsed)}';
    } catch (_) {
      return isoTimestamp;
    }
  }

  /// Short weekday label for the 7-day strip, e.g. "Mon".
  static String weekdayShort(String isoDate) {
    try {
      final parsed = _isoDateFmt.parse(isoDate);
      return DateFormat('EEE').format(parsed);
    } catch (_) {
      return '';
    }
  }

  /// Day-of-month for the 7-day strip, e.g. "28".
  static String dayOfMonth(String isoDate) {
    try {
      final parsed = _isoDateFmt.parse(isoDate);
      return DateFormat('d').format(parsed);
    } catch (_) {
      return '';
    }
  }
}
