import 'package:flutter/material.dart';

import '../api/api_exception.dart';

/// Shared presentation for PA-R4's non-field errors: a 503 or a network
/// failure should always surface as a snackbar with a fixed message,
/// regardless of which screen triggered the call.
class ErrorPresenter {
  ErrorPresenter._();

  /// Shows the right snackbar for a network/503 failure. Returns true if a
  /// snackbar was shown (caller can skip its own generic error handling).
  static bool showIfInfra(BuildContext context, ApiException e) {
    if (e.isNetworkError) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No internet connection')),
      );
      return true;
    }
    if (e.isServiceUnavailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Service temporarily unavailable, please try again.')),
      );
      return true;
    }
    return false;
  }
}
