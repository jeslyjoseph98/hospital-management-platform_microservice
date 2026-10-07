import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncGet } from '../src/clients/httpClient';
import { BusinessError } from '../src/utils/BusinessError';

const originalFetch = global.fetch;

describe('syncGet', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ hello: 'world' })
    }) as unknown as typeof fetch;

    const result = await syncGet<{ hello: string }>('http://x/y');
    expect(result).toEqual({ hello: 'world' });
  });

  it('maps a network error to SERVICE_UNAVAILABLE (503)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch;

    await expect(syncGet('http://x/y')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 503
    });
  });

  it('maps a 5xx response to SERVICE_UNAVAILABLE', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false, json: async () => ({}) }) as unknown as typeof fetch;

    await expect(syncGet('http://x/y')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 503
    });
  });

  it('returns null for 404 when notFoundReturnsNull is set', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false, json: async () => ({}) }) as unknown as typeof fetch;

    const result = await syncGet('http://x/y', { notFoundReturnsNull: true });
    expect(result).toBeNull();
  });

  it('maps 404 to SERVICE_UNAVAILABLE when notFoundReturnsNull is not set', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false, json: async () => ({}) }) as unknown as typeof fetch;

    await expect(syncGet('http://x/y')).rejects.toBeInstanceOf(BusinessError);
    await expect(syncGet('http://x/y')).rejects.toMatchObject({ status: 503 });
  });
});
