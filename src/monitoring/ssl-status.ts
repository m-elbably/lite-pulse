import type { SslCheckResult } from '../shared/types';

/** In-memory store of the most recent SSL check result per service. */
const sslResults = new Map<string, SslCheckResult>();

export function setSslResult(result: SslCheckResult): void {
  sslResults.set(result.serviceId, result);
}

export function getSslResult(serviceId: string): SslCheckResult | null {
  return sslResults.get(serviceId) ?? null;
}

export function clearSslResult(serviceId: string): void {
  sslResults.delete(serviceId);
}

