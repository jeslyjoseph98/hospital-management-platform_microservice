import type { ApiEnvelope, ApiError, FieldError } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const TOKEN_KEY = "clinic_web_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Error thrown by `apiFetch` for any non-2xx response, or a network-level
 * failure. `status === 0` marks a network error/timeout (no response at all),
 * which we treat the same as 503 for toast purposes.
 */
export class ApiRequestError extends Error {
  status: number;
  errorCode: string;
  fieldErrors: FieldError[];

  constructor(status: number, errorCode: string, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors;
  }
}

/** Raised specifically on 401 so callers (AuthGuard et al.) can force a logout + redirect. */
export class UnauthorizedError extends ApiRequestError {
  constructor(message: string) {
    super(401, "AUTH_TOKEN_INVALID", message);
    this.name = "UnauthorizedError";
  }
}

/** Raised on 503 or network failure, per CW-R6: toast "Service temporarily unavailable". */
export class ServiceUnavailableError extends ApiRequestError {
  constructor(message = "Service temporarily unavailable, please try again.") {
    super(503, "SERVICE_UNAVAILABLE", message);
    this.name = "ServiceUnavailableError";
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Wrapper around fetch for the gateway API. Adds the bearer token, parses the
 * standard envelope, and throws typed errors so UI code can branch on status.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const token = skipAuth ? null : getToken();

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (token) {
    finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
    });
  } catch {
    // Network error, timeout, CORS failure, backend not running, etc.
    throw new ServiceUnavailableError();
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    clearToken();
    const message = (body as ApiError | null)?.message ?? "Session expired. Please log in again.";
    throw new UnauthorizedError(message);
  }

  if (response.status === 503) {
    throw new ServiceUnavailableError((body as ApiError | null)?.message);
  }

  if (!response.ok || !body || body.success === false) {
    const err = body as ApiError | null;
    throw new ApiRequestError(
      response.status,
      err?.errorCode ?? "UNKNOWN_ERROR",
      err?.message ?? "Something went wrong. Please try again.",
      err?.fieldErrors ?? []
    );
  }

  return (body as { data: T }).data;
}
