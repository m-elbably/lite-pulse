import type { ServiceConfig, CheckResult } from '../../shared/types';

function describeHttpFailure(error: unknown, service: ServiceConfig): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return `Request timed out after ${service.timeout}s. The service did not respond within the configured timeout.`;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const hostname = (() => {
    try {
      return new URL(service.url ?? '').hostname;
    } catch {
      return service.url ?? 'the target host';
    }
  })();

  if (normalized.includes('econnrefused') || normalized.includes('connection refused')) {
    return `Connection refused by ${hostname}. The host is reachable, but nothing is accepting connections at the target port.`;
  }

  if (normalized.includes('enotfound') || normalized.includes('dns') || normalized.includes('getaddrinfo')) {
    return `DNS lookup failed for ${hostname}. Verify the hostname resolves correctly from the monitoring server.`;
  }

  if (normalized.includes('certificate') || normalized.includes('tls') || normalized.includes('ssl')) {
    return `TLS handshake failed while connecting to ${hostname}. Verify the certificate chain, hostname, and protocol settings.`;
  }

  if (normalized.includes('networkerror') || normalized.includes('fetch failed') || normalized.includes('failed to fetch')) {
    return `Unable to connect to ${hostname}. Check outbound network access, firewall rules, and whether the endpoint is reachable from the monitoring server.`;
  }

  return `Request to ${hostname} failed: ${message}`;
}

export async function runHttpCheck(service: ServiceConfig): Promise<CheckResult> {
  const start = Date.now();
  const checkedAt = new Date();
  const method = service.method ?? 'GET';
  const expectedStatus = service.expectedStatus ?? 200;
  const timeoutMs = service.timeout * 1000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(service.url!, {
        method,
        headers: service.headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const responseTime = Date.now() - start;

    if (response.status !== expectedStatus) {
      return {
        serviceId: service.id,
        status: 'down',
        responseTime,
        checkedAt,
        httpStatus: response.status,
        error: `Expected status ${expectedStatus}, got ${response.status}`,
      };
    }

    return {
      serviceId: service.id,
      status: 'up',
      responseTime,
      checkedAt,
      httpStatus: response.status,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - start;

    return {
      serviceId: service.id,
      status: 'down',
      responseTime,
      checkedAt,
      error: describeHttpFailure(error, service),
    };
  }
}
