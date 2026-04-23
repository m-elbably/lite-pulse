import { describe, it, expect, mock } from 'bun:test';
import type { ServiceConfig } from '../../src/shared/types';

const httpService: ServiceConfig = {
  id: 'http-svc',
  name: 'HTTP Service',
  type: 'http',
  url: 'https://example.com/health',
  interval: 60,
  timeout: 5,
  method: 'GET',
  expectedStatus: 200,
  failureThreshold: 3,
  successThreshold: 2,
};

describe('runHttpCheck', () => {
  it('returns up on expected status', async () => {
    globalThis.fetch = mock(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    const { runHttpCheck } = await import('../../src/monitoring/checkers/http');
    const result = await runHttpCheck(httpService);
    expect(result.status).toBe('up');
    expect(result.httpStatus).toBe(200);
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('returns down on unexpected status', async () => {
    globalThis.fetch = mock(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch;
    const { runHttpCheck } = await import('../../src/monitoring/checkers/http');
    const result = await runHttpCheck(httpService);
    expect(result.status).toBe('down');
    expect(result.error).toContain('Expected status 200, got 404');
  });

  it('returns down on network error', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const { runHttpCheck } = await import('../../src/monitoring/checkers/http');
    const result = await runHttpCheck(httpService);
    expect(result.status).toBe('down');
    expect(result.error).toContain('Connection refused by example.com');
  });

  it('returns down with timeout message on abort', async () => {
    globalThis.fetch = mock(async () => {
      const error = new Error('The operation was aborted');
      Object.defineProperty(error, 'name', { value: 'AbortError' });
      throw error;
    }) as unknown as typeof fetch;
    const { runHttpCheck } = await import('../../src/monitoring/checkers/http');
    const result = await runHttpCheck(httpService);
    expect(result.status).toBe('down');
    expect(result.error).toContain('Request timed out after 5s');
  });

  it('returns a clearer DNS failure message', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('getaddrinfo ENOTFOUND example.com');
    }) as unknown as typeof fetch;
    const { runHttpCheck } = await import('../../src/monitoring/checkers/http');
    const result = await runHttpCheck(httpService);
    expect(result.status).toBe('down');
    expect(result.error).toContain('DNS lookup failed for example.com');
  });
});
