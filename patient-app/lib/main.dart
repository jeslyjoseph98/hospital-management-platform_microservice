import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'api/hms_api.dart';
import 'providers/auth_provider.dart';
import 'providers/booking_provider.dart';
import 'providers/notification_provider.dart';
import 'router.dart';

/// API_URL is supplied with --dart-define, e.g.:
///   flutter run --dart-define=API_URL=http://10.0.2.2:8080/api/v1   (Android emulator)
///   flutter run --dart-define=API_URL=http://localhost:8080/api/v1 (web / iOS simulator)
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:8080/api/v1',
);

void main() {
  final apiClient = ApiClient(baseUrl: apiUrl);
  final api = HmsApi(apiClient);

  final authProvider = AuthProvider(api);
  final bookingProvider = BookingProvider(api);
  final notificationProvider = NotificationProvider(api);

  // PA-R4: any 401 from any in-flight call clears the session and the router
  // redirect (driven by authProvider as a Listenable) sends the user to
  // Login.
  apiClient.onUnauthorized = () {
    notificationProvider.stop();
    authProvider.forceLogout();
  };

  runApp(
    MultiProvider(
      providers: [
        Provider<HmsApi>.value(value: api),
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider<BookingProvider>.value(value: bookingProvider),
        ChangeNotifierProvider<NotificationProvider>.value(value: notificationProvider),
      ],
      child: const PatientApp(),
    ),
  );
}

class PatientApp extends StatefulWidget {
  const PatientApp({super.key});

  @override
  State<PatientApp> createState() => _PatientAppState();
}

class _PatientAppState extends State<PatientApp> {
  late final GoRouter _router;
  late final AuthProvider _auth;
  late final NotificationProvider _notifications;

  @override
  void initState() {
    super.initState();
    _auth = context.read<AuthProvider>();
    _notifications = context.read<NotificationProvider>();
    final api = context.read<HmsApi>();

    _router = buildRouter(authProvider: _auth, api: api, refresh: _auth);

    // PA-R5: validate any stored token on app start.
    _auth.addListener(_onAuthChanged);
    _auth.restoreSession();
  }

  void _onAuthChanged() {
    if (_auth.status == AuthStatus.authenticated) {
      _notifications.start();
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'HMS Patient',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7C3AED)),
        useMaterial3: true,
      ),
      routerConfig: _router,
    );
  }
}
