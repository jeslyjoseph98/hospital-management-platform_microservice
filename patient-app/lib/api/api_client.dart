import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'token_storage.dart';

/// Callback invoked whenever the server tells us the token is invalid/expired
/// (401) so the app can clear session state and redirect to Login (PA-R4).
typedef UnauthorizedCallback = void Function();

/// Thin wrapper around a single [Dio] instance talking only to the gateway
/// (`API_URL`, passed with --dart-define). Adds the bearer token to every
/// request and normalizes every failure into an [ApiException].
class ApiClient {
  ApiClient._internal(this._dio);

  static ApiClient? _instance;

  factory ApiClient({required String baseUrl}) {
    if (_instance != null) return _instance!;
    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 10),
        contentType: 'application/json',
      ),
    );
    final client = ApiClient._internal(dio);
    dio.interceptors.add(client._authInterceptor());
    _instance = client;
    return client;
  }

  final Dio _dio;

  /// Set by main.dart / AuthProvider so 401 responses can trigger a global
  /// logout + redirect without a direct dependency on the provider here.
  UnauthorizedCallback? onUnauthorized;

  InterceptorsWrapper _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await TokenStorage.instance.readToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        handler.next(response);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          onUnauthorized?.call();
        }
        handler.next(error);
      },
    );
  }

  /// Unwraps the standard envelope `{ success, data, message }` on success,
  /// or throws [ApiException] built from the standard error envelope
  /// `{ success:false, errorCode, message, fieldErrors }` (SVC-00 §7).
  Future<dynamic> _unwrap(Future<Response<dynamic>> Function() call) async {
    try {
      final response = await call();
      final body = response.data;
      if (body is Map<String, dynamic>) {
        return body['data'];
      }
      return body;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// Like [_unwrap] but also returns the top-level `message` (needed for the
  /// booking success toast and register/login confirmations).
  Future<MapEntry<dynamic, String?>> _unwrapWithMessage(
    Future<Response<dynamic>> Function() call,
  ) async {
    try {
      final response = await call();
      final body = response.data;
      if (body is Map<String, dynamic>) {
        return MapEntry(body['data'], body['message'] as String?);
      }
      return MapEntry(body, null);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final response = e.response;
    if (response == null) {
      // No HTTP response at all: timeout, connection refused, DNS failure,
      // or no connectivity at all (PA-R4: "No internet connection").
      return ApiException(
        message: 'No internet connection',
        isNetworkError: true,
      );
    }

    final status = response.statusCode;
    final data = response.data;

    if (status == 503) {
      return ApiException(
        statusCode: 503,
        errorCode: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unavailable, please try again.',
      );
    }

    if (data is Map<String, dynamic>) {
      final fieldErrors = (data['fieldErrors'] as List<dynamic>? ?? [])
          .map((f) => FieldError.fromJson(f as Map<String, dynamic>))
          .toList();
      return ApiException(
        statusCode: status,
        errorCode: data['errorCode'] as String?,
        message: (data['message'] as String?) ?? 'Something went wrong',
        fieldErrors: fieldErrors,
      );
    }

    return ApiException(
      statusCode: status,
      message: 'Something went wrong',
    );
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParameters}) {
    return _unwrap(() => _dio.get(path, queryParameters: queryParameters));
  }

  Future<MapEntry<dynamic, String?>> getWithMessage(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) {
    return _unwrapWithMessage(
        () => _dio.get(path, queryParameters: queryParameters));
  }

  Future<MapEntry<dynamic, String?>> post(String path, {dynamic data}) {
    return _unwrapWithMessage(() => _dio.post(path, data: data));
  }

  Future<MapEntry<dynamic, String?>> patch(String path, {dynamic data}) {
    return _unwrapWithMessage(() => _dio.patch(path, data: data));
  }

  Future<MapEntry<dynamic, String?>> put(String path, {dynamic data}) {
    return _unwrapWithMessage(() => _dio.put(path, data: data));
  }
}
