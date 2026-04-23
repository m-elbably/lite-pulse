import { logger } from '../../shared/logger';
import type { ValidatedAlertChannel } from '../../config/schemas';
import type { AlertEvent, IdentifiedIncident } from '../dispatcher';
import type { SslCheckResult } from '../../shared/types';
async function post(channel: ValidatedAlertChannel, payload: unknown): Promise<void> {
  const response = await fetch(channel.url!, {
    method: channel.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...channel.headers },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Webhook responded with HTTP ${response.status}`);
  }
}
export async function sendWebhookAlert(
  channel: ValidatedAlertChannel,
  event: AlertEvent,
  serviceId: string,
  serviceName: string,
  incident: IdentifiedIncident,
): Promise<void> {
  await post(channel, {
    event,
    service: { id: serviceId, name: serviceName },
    incident: {
      id: incident.id,
      openedAt: incident.openedAt,
      resolvedAt: incident.resolvedAt,
      duration: incident.duration,
      cause: incident.cause,
    },
  });
  logger.info({ channel: channel.id, event, serviceName }, 'Webhook alert sent');
}
export async function sendWebhookSslWarning(
  channel: ValidatedAlertChannel,
  result: SslCheckResult,
  serviceName: string,
): Promise<void> {
  await post(channel, {
    event: 'ssl.expiry.warning',
    service: { name: serviceName },
    ssl: {
      hostname: result.hostname,
      expiresAt: result.expiresAt,
      daysRemaining: result.daysRemaining,
    },
  });
  logger.info({ channel: channel.id, serviceName }, 'Webhook SSL warning sent');
}
