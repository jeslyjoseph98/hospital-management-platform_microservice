import { BusinessError } from '../utils/BusinessError';

const CONNECT_TIMEOUT_MS = 2000;
const TOTAL_TIMEOUT_MS = 5000;

export interface SyncGetOptions {
  requestId?: string;
  /** If set, a 404 response resolves to `null` instead of throwing SERVICE_UNAVAILABLE. */
  notFoundReturnsNull?: boolean;
}

/**
 * Performs a GET with a 2s connect timeout / 5s total timeout (SVC-00 MS-R4, SVC-04 §2A).
 * Any network failure, abort, or 5xx maps to 503 SERVICE_UNAVAILABLE.
 * A 404 either returns null (if notFoundReturnsNull) or also maps to SERVICE_UNAVAILABLE's
 * sibling — callers that need a specific not-found error code handle it themselves by
 * passing notFoundReturnsNull and mapping null to their own BusinessError.
 */
export async function syncGet<T>(url: string, options: SyncGetOptions = {}): Promise<T | null> {
  const totalController = new AbortController();
  const connectController = new AbortController();

  const totalTimer = setTimeout(() => totalController.abort(), TOTAL_TIMEOUT_MS);
  const connectTimer = setTimeout(() => connectController.abort(), CONNECT_TIMEOUT_MS);

  // Combine both signals: if either fires, abort the request.
  const combinedController = new AbortController();
  const onAbort = () => combinedController.abort();
  totalController.signal.addEventListener('abort', onAbort);
  connectController.signal.addEventListener('abort', onAbort);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.requestId) headers['X-Request-Id'] = options.requestId;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: combinedController.signal
      });
    } catch (err) {
      // Network error, connection refused, or abort (timeout).
      throw new BusinessError('SERVICE_UNAVAILABLE', 503, 'A dependent service is unavailable.');
    } finally {
      clearTimeout(connectTimer);
    }

    if (response.status === 404) {
      if (options.notFoundReturnsNull) return null;
      throw new BusinessError('SERVICE_UNAVAILABLE', 503, 'A dependent service is unavailable.');
    }

    if (response.status >= 500) {
      throw new BusinessError('SERVICE_UNAVAILABLE', 503, 'A dependent service is unavailable.');
    }

    if (!response.ok) {
      // Any other non-2xx (e.g. 400) from an internal API is treated as unavailable per MS-R4
      // ("non-2xx ... → SERVICE_UNAVAILABLE").
      throw new BusinessError('SERVICE_UNAVAILABLE', 503, 'A dependent service is unavailable.');
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(connectTimer);
    totalController.signal.removeEventListener('abort', onAbort);
    connectController.signal.removeEventListener('abort', onAbort);
  }
}
