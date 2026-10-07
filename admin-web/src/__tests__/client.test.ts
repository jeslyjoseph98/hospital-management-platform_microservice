import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, SERVICE_UNAVAILABLE_EVENT, UNAUTHORIZED_EVENT } from '../api/client';
import { ApiRequestError } from '../types/api';
import { clearToken, setToken } from '../api/token';

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      json: async () => body,
    }),
  );
}

describe('apiRequest', () => {
  beforeEach(() => {
    clearToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearToken();
  });

  it('resolves with data on success envelope', async () => {
    mockFetchOnce(200, { success: true, data: { foo: 'bar' } });
    const result = await apiRequest<{ foo: string }>('/ping');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('throws ApiRequestError with fieldErrors on a 400 validation failure', async () => {
    mockFetchOnce(400, {
      success: false,
      errorCode: 'VALIDATION_FAILED',
      message: 'Validation failed',
      fieldErrors: [{ field: 'phone', message: 'Phone is required' }],
      data: null,
    });

    await expect(apiRequest('/auth/register')).rejects.toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      fieldErrors: [{ field: 'phone', message: 'Phone is required' }],
    });
  });

  it('exposes data.affected on a 409 conflict', async () => {
    mockFetchOnce(409, {
      success: false,
      errorCode: 'ADM_DAY_HAS_BOOKINGS',
      message: 'Friday cannot be removed: there are future bookings.',
      fieldErrors: [],
      data: { affected: [{ date: '2026-10-02', booked: 14 }] },
    });

    try {
      await apiRequest('/admin/doctors/3/timings');
      throw new Error('expected apiRequest to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError);
      const apiErr = err as ApiRequestError;
      expect(apiErr.data?.affected).toEqual([{ date: '2026-10-02', booked: 14 }]);
    }
  });

  it('clears the token and emits UNAUTHORIZED_EVENT on 401', async () => {
    setToken('stale-token');
    mockFetchOnce(401, {
      success: false,
      errorCode: 'AUTH_TOKEN_INVALID',
      message: 'Invalid token',
      fieldErrors: [],
      data: null,
    });

    const handler = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);

    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiRequestError);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  });

  it('does not emit UNAUTHORIZED_EVENT on 401 when skipUnauthorizedRedirect is set', async () => {
    mockFetchOnce(401, {
      success: false,
      errorCode: 'AUTH_TOKEN_INVALID',
      message: 'Invalid token',
      fieldErrors: [],
      data: null,
    });

    const handler = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);

    await expect(apiRequest('/auth/me', { skipUnauthorizedRedirect: true })).rejects.toBeInstanceOf(
      ApiRequestError,
    );
    expect(handler).not.toHaveBeenCalled();

    window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  });

  it('emits SERVICE_UNAVAILABLE_EVENT on 503', async () => {
    mockFetchOnce(503, {
      success: false,
      errorCode: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
      fieldErrors: [],
      data: null,
    });

    const handler = vi.fn();
    window.addEventListener(SERVICE_UNAVAILABLE_EVENT, handler);

    await expect(apiRequest('/admin/doctors')).rejects.toBeInstanceOf(ApiRequestError);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(SERVICE_UNAVAILABLE_EVENT, handler);
  });
});
