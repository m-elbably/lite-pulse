import { randomUUID } from 'node:crypto';
import { bus } from '../monitoring/bus';
import { getOpenIncident } from '../db/repos';
import { isPaused } from '../monitoring/paused';
import { sendEmailAlert, sendEmailSslWarning } from './channels/email';
import { sendWebhookAlert, sendWebhookSslWarning } from './channels/webhook';
import { sendTelegramAlert, sendTelegramSslWarning } from './channels/telegram';
import { logger } from '../shared/logger';
import { isInMaintenance } from '../monitoring/maintenance';
import { canAlert, recordAlert } from './cooldown';
import type { ValidatedAlertChannel, ValidatedServiceConfig } from '../config/schemas';
import type { Incident, SslCheckResult } from '../shared/types';

export type AlertEvent = 'incident.opened' | 'incident.resolved';
export type IdentifiedIncident = Incident & { id: string };
export interface DeliveryStatus {
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  error: string | null;
  pending: boolean;
}
let alertChannels: ValidatedAlertChannel[] = [];
let services: ValidatedServiceConfig[] = [];
// ponytail: delivery history and deferred alerts reset on restart; persist them if restart-spanning guarantees are needed.
const deliveryStatuses = new Map<string, DeliveryStatus>();
const suppressed = new Map<string, IdentifiedIncident>();

export function getDeliveryStatuses(): Record<string, DeliveryStatus> {
  return Object.fromEntries(deliveryStatuses);
}

async function deliver(channel: ValidatedAlertChannel, send: () => Promise<void>, retry = true): Promise<void> {
  const status: DeliveryStatus = {
    lastAttemptAt: new Date().toISOString(),
    lastSuccessAt: deliveryStatuses.get(channel.id)?.lastSuccessAt ?? null,
    error: null,
    pending: true,
  };
  deliveryStatuses.set(channel.id, status);
  const delays = retry ? [1000, 2000, 4000] : [];
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await send();
        status.lastSuccessAt = new Date().toISOString();
        const latest = deliveryStatuses.get(channel.id);
        if (latest) latest.lastSuccessAt = status.lastSuccessAt;
        return;
      } catch (error) {
        if (attempt >= delays.length) throw error;
        logger.warn({ channel: channel.id, attempt: attempt + 1 }, 'Alert delivery failed, retrying');
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
    logger.error({ channel: channel.id, err: status.error }, 'Alert delivery failed');
    throw error;
  } finally {
    status.pending = false;
  }
}

function sendIncident(channel: ValidatedAlertChannel, event: AlertEvent, serviceName: string, incident: IdentifiedIncident): Promise<void> {
  if (channel.type === 'email') return sendEmailAlert(channel, event, serviceName, incident);
  if (channel.type === 'webhook') return sendWebhookAlert(channel, event, incident.serviceId, serviceName, incident);
  return sendTelegramAlert(channel, event, serviceName, incident);
}

function getChannels(service: ValidatedServiceConfig): ValidatedAlertChannel[] {
  return alertChannels.filter(channel => (service.alertChannels ?? []).includes(channel.id));
}

export async function dispatch(event: AlertEvent, incident: IdentifiedIncident): Promise<void> {
  const service = services.find(service => service.id === incident.serviceId);
  if (!service) return;
  if (event === 'incident.resolved') suppressed.delete(service.id);
  if (isInMaintenance(service.maintenanceWindows ?? []) || isPaused(service.id)
    || (event === 'incident.opened' && !canAlert(service.id, (service.alertCooldownMinutes ?? 0) * 60_000))) {
    if (event === 'incident.opened') suppressed.set(service.id, incident);
    return;
  }
  suppressed.delete(service.id);
  const channels = getChannels(service);
  if (event === 'incident.opened' && channels.length) recordAlert(service.id);
  await Promise.allSettled(channels.map(channel => deliver(channel, () => sendIncident(channel, event, service.name, incident))));
}

export async function flushSuppressedAlert(serviceId: string): Promise<void> {
  const incident = suppressed.get(serviceId);
  const service = services.find(service => service.id === serviceId);
  if (!incident || !service || isPaused(serviceId) || isInMaintenance(service.maintenanceWindows ?? [])
    || !canAlert(serviceId, (service.alertCooldownMinutes ?? 0) * 60_000)) return;
  const current = await getOpenIncident(serviceId);
  if (suppressed.get(serviceId) !== incident) return;
  if (current?.id === incident.id) await dispatch('incident.opened', current);
  else suppressed.delete(serviceId);
}

async function dispatchSslWarning(result: SslCheckResult): Promise<void> {
  const service = services.find(service => service.id === result.serviceId);
  if (!service || isPaused(service.id) || isInMaintenance(service.maintenanceWindows ?? [])) return;
  await Promise.allSettled(getChannels(service).map(channel => deliver(channel, () => {
    if (channel.type === 'email') return sendEmailSslWarning(channel, result, service.name);
    if (channel.type === 'webhook') return sendWebhookSslWarning(channel, result, service.name);
    return sendTelegramSslWarning(channel, result, service.name);
  })));
}

export async function testAlertChannel(channel: ValidatedAlertChannel): Promise<void> {
  const incident: IdentifiedIncident = {
    id: randomUUID(), serviceId: 'litepulse-test', status: 'open', openedAt: new Date(),
    cause: 'This is a test notification from LitePulse. No monitored service is down.',
  };
  await deliver(channel, () => sendIncident(channel, 'incident.opened', 'LitePulse test', incident), false);
}

export function initDispatcher(channels: ValidatedAlertChannel[], svcs: ValidatedServiceConfig[]): void {
  updateDispatcher(channels, svcs);
  bus.on('incident.opened', incident => void dispatch('incident.opened', incident));
  bus.on('incident.resolved', incident => void dispatch('incident.resolved', incident));
  bus.on('ssl.expiry.warning', result => void dispatchSslWarning(result));
  bus.on('check.completed', result => {
    void flushSuppressedAlert(result.serviceId).catch(error => logger.error({ err: String(error) }, 'Maintenance catch-up failed'));
  });
}

export function updateDispatcher(channels: ValidatedAlertChannel[], svcs: ValidatedServiceConfig[]): void {
  alertChannels = channels;
  services = svcs;
  for (const id of deliveryStatuses.keys()) {
    if (!channels.some(channel => channel.id === id)) deliveryStatuses.delete(id);
  }
  for (const id of suppressed.keys()) {
    if (!svcs.some(service => service.id === id)) suppressed.delete(id);
  }
}
