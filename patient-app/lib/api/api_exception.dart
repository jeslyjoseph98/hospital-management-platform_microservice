/// One entry of the `fieldErrors` array (SVC-00 §7).
class FieldError {
  final String field;
  final String message;

  FieldError({required this.field, required this.message});

  factory FieldError.fromJson(Map<String, dynamic> json) {
    return FieldError(
      field: json['field'] as String? ?? '',
      message: json['message'] as String? ?? '',
    );
  }
}

/// Thrown by [ApiClient] for any non-2xx response, or for network-level
/// failures (no connectivity, 503, etc). Carries enough detail for screens to
/// show field errors (PA-R6) or a dialog/snackbar message.
class ApiException implements Exception {
  final int? statusCode;
  final String? errorCode;
  final String message;
  final List<FieldError> fieldErrors;

  /// True when there was no HTTP response at all (DNS / connection refused /
  /// timeout) — used to show "No internet connection" (PA-R4).
  final bool isNetworkError;

  ApiException({
    this.statusCode,
    this.errorCode,
    required this.message,
    this.fieldErrors = const [],
    this.isNetworkError = false,
  });

  bool get isUnauthorized => statusCode == 401;
  bool get isServiceUnavailable => statusCode == 503;
  bool get isConflict => statusCode == 409;

  @override
  String toString() => message;
}
