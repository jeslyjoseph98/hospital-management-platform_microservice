import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_exception.dart';
import '../api/hms_api.dart';
import '../api/token_storage.dart';
import '../models/patient_profile.dart';
import '../models/user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Holds the current session: token presence, decoded user, and profile.
/// Also implements the app-start session restore (PA-R5) and the "wrong
/// role" rejection (PA-R2).
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api);

  final HmsApi _api;

  AuthStatus status = AuthStatus.unknown;
  AppUser? user;
  PatientProfile? profile;
  String? sessionMessage;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  /// PA-R5: on app start, if a token is stored, validate it via /auth/me.
  Future<void> restoreSession() async {
    final token = await TokenStorage.instance.readToken();
    if (token == null || token.isEmpty) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      final me = await _api.me();
      if (me.role != 'PATIENT') {
        await _rejectWrongRole();
        return;
      }
      user = me;
      status = AuthStatus.authenticated;
      notifyListeners();
      // Best-effort; profile isn't required for the guard to pass.
      unawaited(loadProfile());
    } on ApiException {
      await TokenStorage.instance.clearToken();
      status = AuthStatus.unauthenticated;
      notifyListeners();
    }
  }

  Future<void> register({
    required String fullName,
    required String phone,
    String? email,
    required String password,
    required String dateOfBirth,
    required String gender,
    String? address,
  }) async {
    await _api.register(
      fullName: fullName,
      phone: phone,
      email: email,
      password: password,
      dateOfBirth: dateOfBirth,
      gender: gender,
      address: address,
    );
  }

  Future<void> login({required String phone, required String password}) async {
    final result = await _api.login(phone: phone, password: password);
    if (result.user.role != 'PATIENT') {
      // Should not happen since this app always sends role: PATIENT and the
      // backend validates it, but guard anyway (PA-R2).
      sessionMessage = 'This app is for patients';
      throw ApiException(message: sessionMessage!, errorCode: 'AUTH_ROLE_MISMATCH');
    }
    await TokenStorage.instance.saveToken(result.accessToken);
    user = result.user;
    status = AuthStatus.authenticated;
    notifyListeners();
    unawaited(loadProfile());
  }

  Future<void> loadProfile() async {
    try {
      profile = await _api.myProfile();
      notifyListeners();
    } on ApiException {
      // Non-fatal: profile tab will show a retry/error state.
    }
  }

  Future<void> logout() async {
    await TokenStorage.instance.clearToken();
    user = null;
    profile = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  /// Called by the Dio interceptor (via main.dart wiring) whenever a 401 is
  /// received, so any screen's in-flight request fails into a clean logout.
  Future<void> forceLogout() async {
    await TokenStorage.instance.clearToken();
    user = null;
    profile = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<void> _rejectWrongRole() async {
    await TokenStorage.instance.clearToken();
    user = null;
    status = AuthStatus.unauthenticated;
    sessionMessage = 'This app is for patients';
    notifyListeners();
  }
}
