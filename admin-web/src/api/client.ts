import { ApiEnvelope, ApiRequestError } from '../types/api';
import { clearToken, getToken } from './token';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080/api/v1';

/**
 * Fired whenever the server returns 401 (expired/invalid token) so the app shell
 * can clear auth state and redirect to /login (AW-R2, AW-R4, AW-R5).
 */
export const UNAUTHORIZED_EVENT = 'hms:unauthorized';

/**
 * Fired whenever the server returns 503 so the app shell can show a toast
 * ("Service temporarily unavailable, please try again.") — AW-R4.
 */
export const SERVICE_UNAVAILABLE_EVENT = 'hms:service-unavailable';

function emit(eventName: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip attaching the Authorization header (login/register calls). */
  skipAuth?: boolean;
  /** Skip emitting the global 401 redirect event (used by /auth/me on first load). */
  skipUnauthorizedRedirect?: boolean;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper around the gateway's envelope format (SVC-00 §7).
 * - Attaches `Authorization: Bearer <token>` unless skipAuth is set.
 * - On success:true -> resolves with `data`.
 * - On success:false -> throws ApiRequestError (caller inspects errorCode / fieldErrors / data.affected).
 * - On HTTP 401 -> clears token, emits UNAUTHORIZED_EVENT, still throws.
 * - On HTTP 503 (or network/transport failure) -> emits SERVICE_UNAVAILABLE_EVENT, still throws.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false, skipUnauthorizedRedirect = false, signal } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkError) {
    // Gateway unreachable / network failure — treat like service unavailable so the
    // user gets a toast instead of an unhandled rejection.
    emit(SERVICE_UNAVAILABLE_EVENT);
    throw networkError;
  }

  if (response.status === 503) {
    emit(SERVICE_UNAVAILABLE_EVENT);
  }

  if (response.status === 401) {
    clearToken();
    if (!skipUnauthorizedRedirect) {
      emit(UNAUTHORIZED_EVENT);
    }
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // No/invalid JSON body (e.g. gateway-level 503 HTML page).
    envelope = null;
  }

  if (!envelope) {
    throw new ApiRequestError(response.status, {
      success: false,
      errorCode: response.status === 503 ? 'SERVICE_UNAVAILABLE' : 'UNKNOWN_ERROR',
      message:
        response.status === 503
          ? 'Service temporarily unavailable, please try again.'
          : `Request failed with status ${response.status}`,
      fieldErrors: [],
      data: null,
    });
  }

  if (!envelope.success) {
    throw new ApiRequestError(response.status, envelope);
  }

  return envelope.data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
