import 'package:flutter/foundation.dart';

import '../api/hms_api.dart';
import '../models/availability.dart';
import '../models/booking_result.dart';
import '../models/department.dart';
import '../models/doctor.dart';

/// Drives the Book flow: departments -> doctors -> availability -> booking.
/// Kept as one provider since the steps are strictly sequential and share
/// selection state (department/doctor), per SVC-07B §6.
class BookingProvider extends ChangeNotifier {
  BookingProvider(this._api);

  final HmsApi _api;

  // Departments
  List<Department> departments = [];
  bool loadingDepartments = false;

  // Doctors
  Department? selectedDepartment;
  List<Doctor> doctors = [];
  bool loadingDoctors = false;

  // Availability
  Doctor? selectedDoctor;
  DoctorAvailability? availability;
  bool loadingAvailability = false;
  AvailabilityDate? selectedDate;

  // Booking in-flight guard (PA-R7: disable Confirm Booking while in flight).
  bool booking = false;
  BookingResult? lastBookingResult;

  Future<void> loadDepartments() async {
    loadingDepartments = true;
    notifyListeners();
    try {
      departments = await _api.departments();
    } finally {
      loadingDepartments = false;
      notifyListeners();
    }
  }

  Future<void> selectDepartment(Department department) async {
    selectedDepartment = department;
    doctors = [];
    loadingDoctors = true;
    notifyListeners();
    try {
      doctors = await _api.doctorsInDepartment(department.id);
    } finally {
      loadingDoctors = false;
      notifyListeners();
    }
  }

  Future<void> selectDoctor(Doctor doctor) async {
    selectedDoctor = doctor;
    availability = null;
    selectedDate = null;
    await reloadAvailability();
  }

  Future<void> reloadAvailability() async {
    final doctor = selectedDoctor;
    if (doctor == null) return;
    loadingAvailability = true;
    notifyListeners();
    try {
      availability = await _api.availability(doctor.id);
      // Keep the selected date pointer fresh with the latest status.
      if (selectedDate != null) {
        selectedDate = availability!.dates.firstWhere(
          (d) => d.date == selectedDate!.date,
          orElse: () => selectedDate!,
        );
      }
    } finally {
      loadingAvailability = false;
      notifyListeners();
    }
  }

  void pickDate(AvailabilityDate date) {
    if (!date.isTappable) return;
    selectedDate = date;
    notifyListeners();
  }

  Future<BookingResult> confirmBooking({String? reason}) async {
    final doctor = selectedDoctor;
    final date = selectedDate;
    if (doctor == null || date == null) {
      throw StateError('Doctor and date must be selected before booking');
    }
    booking = true;
    notifyListeners();
    try {
      final result = await _api.book(
        doctorId: doctor.id,
        appointmentDate: date.date,
        reason: reason,
      );
      lastBookingResult = result;
      return result;
    } finally {
      booking = false;
      notifyListeners();
    }
  }

  /// Reset all selection state — called when the user starts a new booking
  /// from the bottom nav "Book" tab after a previous booking completed.
  void resetFlow() {
    selectedDepartment = null;
    doctors = [];
    selectedDoctor = null;
    availability = null;
    selectedDate = null;
    lastBookingResult = null;
    notifyListeners();
  }
}
