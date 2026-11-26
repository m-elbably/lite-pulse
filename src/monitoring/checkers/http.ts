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

  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'ConnectionRefused' || normalized.includes('econnrefused') || normalized.includes('connection refused')) {
    return `Connection refused by ${hostname}. The host is reachable, but nothing is accepting connections at the target port.`;
  }

  if (normalized.includes('enotfound') || normalized.includes('dns') || normalized.includes('getaddrinfo')) {
    return `DNS lookup failed for ${hostname}. Verify the hostname resolves correctly from the monitoring server.`;
  }

  if (normalized.includes('certificate') || normalized.includes('tls') || normalized.includes('ssl')) {
    return `TLS handshake failed while connecting to ${hostname}. Verify the certificate chain, hostname, and protocol settings.`;
  }

  if (normalized.includes('networkerror') || normalized.includes('fetch failed') || normalized.includes('failed to fetch') || normalized.includes('unable to connect')) {
    return `Unable to connect to ${hostname}. Check outbound network access, firewall rules, and whether the endpoint is reachable from the monitoring server.`;
  }

  return `Request to ${hostname} failed: ${message}`;
}

export async function runHttpCheck(service: ServiceConfig): Promise<CheckResult> {
  const start = Date.now();
  const checkedAt = new Date();
  const method = service.method ?? 'GET';
  const controller = new AbortController();
  // The timeout covers the body read too, since keyword checks consume it.
  const timer = setTimeout(() => controller.abort(), service.timeout * 1000);
  const down = (error: string, httpStatus?: number): CheckResult => ({
    serviceId: service.id, status: 'down', responseTime: Date.now() - start, checkedAt, httpStatus, error,
  });

  try {
    const response = await fetch(service.url!, {
      method,
      headers: service.headers,
      signal: controller.signal,
    });
    const responseTime = Date.now() - start;
    const statusOk = service.expectedStatus
      ? response.status === service.expectedStatus
      : response.status >= 200 && response.status < 300;

    if (!statusOk || !service.expectedKeyword) {
      // Always release the body so sockets are not held open.
      await response.body?.cancel();
    }
    if (!statusOk) {
      return down(`Expected status ${service.expectedStatus ?? '2xx'}, got ${response.status}`, response.status);
    }
    if (service.expectedKeyword && !(await response.text()).includes(service.expectedKeyword)) {
      return down(`Response body does not contain "${service.expectedKeyword}"`, response.status);
    }

    return {
      serviceId: service.id,
      status: 'up',
      responseTime,
      checkedAt,
      httpStatus: response.status,
    };
  } catch (error: unknown) {
    return down(describeHttpFailure(error, service));
  } finally {
    clearTimeout(timer);
  }
}
