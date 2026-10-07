import 'package:flutter/material.dart';

/// Shown briefly while [AuthProvider.restoreSession] validates a stored
/// token against GET /auth/me (PA-R5).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_hospital, size: 64, color: Color(0xFF7C3AED)),
            SizedBox(height: 24),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
