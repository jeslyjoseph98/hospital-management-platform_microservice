import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'api/hms_api.dart';
import 'models/booking_result.dart';
import 'providers/auth_provider.dart';
import 'screens/appointments/appointment_detail_screen.dart';
import 'screens/appointments/my_appointments_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/booking/booking_success_screen.dart';
import 'screens/booking/date_availability_screen.dart';
import 'screens/booking/departments_screen.dart';
import 'screens/booking/doctors_screen.dart';
import 'screens/home_shell.dart';
import 'screens/notifications/notifications_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/splash_screen.dart';

/// Builds the app's go_router instance with a redirect-based route guard
/// implementing PA-R1..PA-R5 (SVC-07B §4).
///
/// [authProvider] drives the redirect decision; [refresh] makes go_router
/// re-evaluate the redirect whenever auth state changes (login/logout/token
/// cleared on 401).
GoRouter buildRouter({
  required AuthProvider authProvider,
  required HmsApi api,
  required Listenable refresh,
}) {
  const authRoutes = {'/login', '/register'};

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: refresh,
    redirect: (context, state) {
      final location = state.matchedLocation;
      final isAuthRoute = authRoutes.contains(location);

      switch (authProvider.status) {
        case AuthStatus.unknown:
          // PA-R5: still validating a stored token against /auth/me.
          return location == '/splash' ? null : '/splash';
        case AuthStatus.unauthenticated:
          // PA-R1 / PA-R2: no token, or token was rejected — go to Login.
          if (location == '/splash' || !isAuthRoute) return '/login';
          return null;
        case AuthStatus.authenticated:
          // PA-R3: logged in and sitting on Login/Register/Splash -> Home.
          if (location == '/splash' || isAuthRoute) return '/book';
          return null;
      }
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return HomeShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/book',
                builder: (context, state) => const DepartmentsScreen(),
                routes: [
                  GoRoute(
                    path: 'doctors',
                    builder: (context, state) => const DoctorsScreen(),
                  ),
                  GoRoute(
                    path: 'date',
                    builder: (context, state) => const DateAvailabilityScreen(),
                  ),
                  GoRoute(
                    path: 'success',
                    builder: (context, state) {
                      final result = state.extra as BookingResult;
                      return BookingSuccessScreen(result: result);
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/appointments',
                builder: (context, state) => MyAppointmentsScreen(api: api),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (context, state) {
                      final id = int.parse(state.pathParameters['id']!);
                      return AppointmentDetailScreen(api: api, appointmentId: id);
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/notifications',
                builder: (context, state) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
