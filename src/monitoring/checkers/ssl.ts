import tls from 'tls';
import type { SslCheckResult } from '../../shared/types';

/**
 * Connects to the service's hostname over TLS and reads the peer certificate expiry.
 * Only meaningful for HTTP services with an https:// URL.
 */
export function checkSslExpiry(serviceId: string, url: string, timeoutMs = 10_000): Promise<SslCheckResult> {
  return new Promise(resolve => {
    const checkedAt = new Date();
    let hostname: string;
    let port: number;

    try {
      const target = new URL(url);
      hostname = target.hostname.replace(/^\[|\]$/g, '');
      port = Number(target.port || 443);
    } catch {
      resolve({ serviceId, hostname: url, expiresAt: new Date(0), daysRemaining: -1, checkedAt, error: 'Invalid URL' });
      return;
    }

    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (!cert || !cert.valid_to) {
            resolve({ serviceId, hostname, expiresAt: new Date(0), daysRemaining: -1, checkedAt, error: 'No certificate returned' });
            return;
          }

          const expiresAt = new Date(cert.valid_to);
          const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
          resolve({ serviceId, hostname, expiresAt, daysRemaining, checkedAt });
        } catch (err: unknown) {
          resolve({ serviceId, hostname, expiresAt: new Date(0), daysRemaining: -1, checkedAt, error: err instanceof Error ? err.message : String(err) });
        }
      },
    );

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ serviceId, hostname, expiresAt: new Date(0), daysRemaining: -1, checkedAt, error: `SSL check timed out after ${timeoutMs / 1000}s` });
    });

    socket.on('error', (err: Error) => {
      socket.destroy();
      resolve({ serviceId, hostname, expiresAt: new Date(0), daysRemaining: -1, checkedAt, error: err.message });
    });
  });
}
