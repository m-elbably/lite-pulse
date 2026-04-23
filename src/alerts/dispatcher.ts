import { bus } from '../monitoring/bus';
import { sendEmailAlert, sendEmailSslWarning } from './channels/email';
import { sendWebhookAlert, sendWebhookSslWarning } from './channels/webhook';
import { sendTelegramAlert, sendTelegramSslWarning } from './channels/telegram';
import { logger } from '../shared/logger';
import { isInMaintenance } from '../monitoring/maintenance';
import { canAlert, recordAlert, resetCooldown } from './cooldown';
import type { ValidatedAlertChannel, ValidatedServiceConfig } from '../config/schemas';
import type { Incident, SslCheckResult } from '../shared/types';
export type AlertEvent = 'incident.opened' | 'incident.resolved';
export type IdentifiedIncident = Incident & { id: string };
let alertChannels: ValidatedAlertChannel[] = [];
let services: ValidatedServiceConfig[] = [];
async function withRetry(fn: () => Promise<void>, label: string): Promise<void> {
  const delays = [1000, 2000, 4000] as const;
  for (let i = 0; i <= delays.length; i++) {
try {
  await fn();
  return;
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (i < delays.length) {
logger.warn({ err: message, label, attempt: i + 1 }, 'Alert delivery failed, retrying');
await new Promise(r => setTimeout(r, delays[i]));
  } else {
logger.error({ err: message, label }, 'Alert delivery failed after retries');
  }
}
  }
}
function getChannels(service: ValidatedServiceConfig): ValidatedAlertChannel[] {
  return (service.alertChannels ?? [])
.map(id => alertChannels.find(c => c.id === id))
.filter((c): c is ValidatedAlertChannel => c !== undefined);
}
async function dispatch(event: AlertEvent, incident: IdentifiedIncident): Promise<void> {
  const service = services.find(s => s.id === incident.serviceId);
  if (!service) return;
  if (isInMaintenance(service.maintenanceWindows ?? [])) {
logger.info({ serviceId: service.id, event }, 'Alert suppressed — maintenance window active');
return;
  }
  const cooldownMs = (service.alertCooldownMinutes ?? 0) * 60_000;
  if (event === 'incident.opened') {
if (!canAlert(service.id, cooldownMs)) {
  logger.info({ serviceId: service.id }, 'Alert suppressed — cooldown active');
  return;
}
recordAlert(service.id);
  } else {
resetCooldown(service.id);
  }
  const channels = getChannels(service);
  await Promise.all(
channels.map(channel => {
  const label = `${channel.id}:${event}`;
  if (channel.type === 'email') {
return withRetry(() => sendEmailAlert(channel, event, service.name, incident), label);
  }
  if (channel.type === 'webhook') {
return withRetry(() => sendWebhookAlert(channel, event, service.id, service.name, incident), label);
  }
  return withRetry(() => sendTelegramAlert(channel, event, service.name, incident), label);
}),
  );
}
async function dispatchSslWarning(result: SslCheckResult): Promise<void> {
  const service = services.find(s => s.id === result.serviceId);
  if (!service) return;
  if (isInMaintenance(service.maintenanceWindows ?? [])) return;
  const channels = getChannels(service);
  await Promise.all(
channels.map(channel => {
  const label = `${channel.id}:ssl.expiry.warning`;
  if (channel.type === 'email') {
return withRetry(() => sendEmailSslWarning(channel, result, service.name), label);
  }
  if (channel.type === 'webhook') {
return withRetry(() => sendWebhookSslWarning(channel, result, service.name), label);
  }
  return withRetry(() => sendTelegramSslWarning(channel, result, service.name), label);
}),
  );
}
export function initDispatcher(
  channels: ValidatedAlertChannel[],
  svcs: ValidatedServiceConfig[],
): void {
  alertChannels = channels;
  services = svcs;
  bus.on('incident.opened', incident => void dispatch('incident.opened', incident));
  bus.on('incident.resolved', incident => void dispatch('incident.resolved', incident));
  bus.on('ssl.expiry.warning', result => void dispatchSslWarning(result));
}
export function updateDispatcher(
  channels: ValidatedAlertChannel[],
  svcs: ValidatedServiceConfig[],
): void {
  alertChannels = channels;
  services = svcs;
}
