import { randomUUID } from 'crypto';
import { applyConfig } from './runtime';
import type { AppConfig } from './types';
import type {
  ValidatedAlertChannel,
  ValidatedAlertChannelInput,
  ValidatedServiceConfig,
  ValidatedServiceConfigInput,
} from './schemas';
import { AlertChannelInputSchema, ServiceConfigInputSchema } from './schemas';
import {
  createAlertConfig,
  createServiceConfig,
  deleteAlertConfig,
  deleteServiceConfig,
  listAlerts,
  listServices,
  updateAlertConfig,
  updateServiceConfig,
} from '../db/repos';

export class ConfigStoreError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'CONFIG_ERROR') {
    super(message);
    this.name = 'ConfigStoreError';
  }
}

let writeQueue = Promise.resolve();

function queueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function assertUniqueIds<T extends { id: string }>(items: T[], label: string): void {
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new ConfigStoreError(`Duplicate ${label} id '${item.id}'`, 409, 'DUPLICATE_ID');
    }
    ids.add(item.id);
  }
}

function assertUniqueNames<T extends { name: string }>(items: T[], label: string): void {
  const names = new Set<string>();

  for (const item of items) {
    const normalizedName = normalizeName(item.name);
    if (names.has(normalizedName)) {
      throw new ConfigStoreError(`Duplicate ${label} name '${item.name}'`, 409, 'DUPLICATE_NAME');
    }
    names.add(normalizedName);
  }
}

function assertServiceLimit(services: AppConfig['services']): void {
  if (services.length > 16) {
    throw new ConfigStoreError('A maximum of 16 services is supported', 422, 'SERVICE_LIMIT_EXCEEDED');
  }
}

function validateConfigConsistency(config: AppConfig): void {
  assertServiceLimit(config.services);
  assertUniqueIds(config.services, 'service');
  assertUniqueIds(config.alerts, 'alert channel');
  assertUniqueNames(config.services, 'service');
  assertUniqueNames(config.alerts, 'alert channel');

  const alertIds = new Set(config.alerts.map(alert => alert.id));

  for (const service of config.services) {
    for (const channelId of service.alertChannels ?? []) {
      if (!alertIds.has(channelId)) {
        throw new ConfigStoreError(
          `Service '${service.id}' references unknown alert channel '${channelId}'`,
          422,
          'UNKNOWN_ALERT_CHANNEL',
        );
      }
    }
  }
}

async function readConfigOrThrow(): Promise<AppConfig> {
  const config = {
    services: await listServices(),
    alerts: await listAlerts(),
  };

  validateConfigConsistency(config);
  return config;
}

function finalizeService(service: ValidatedServiceConfigInput, serviceId?: string): ValidatedServiceConfig {
  const parsed = ServiceConfigInputSchema.parse(service);
  const nextId = serviceId ?? parsed.id?.trim() ?? '';

  return {
    ...parsed,
    id: nextId || randomUUID(),
    name: parsed.name.trim(),
  };
}

function finalizeAlert(alert: ValidatedAlertChannelInput, alertId?: string): ValidatedAlertChannel {
  const parsed = AlertChannelInputSchema.parse(alert);
  const nextId = alertId ?? parsed.id?.trim() ?? '';

  return {
    ...parsed,
    id: nextId || randomUUID(),
    name: parsed.name.trim(),
    description: parsed.description?.trim() || undefined,
  };
}

async function validateAndApply(nextConfig: AppConfig): Promise<AppConfig> {
  validateConfigConsistency(nextConfig);

  return applyConfig({
    services: [...nextConfig.services],
    alerts: [...nextConfig.alerts],
  });
}


export async function listConfig(): Promise<AppConfig> {
  return readConfigOrThrow();
}

export async function createService(service: ValidatedServiceConfigInput): Promise<AppConfig> {
  return queueWrite(async () => {
    const config = await readConfigOrThrow();
    const nextService = finalizeService(service);
    const nextConfig = {
      ...config,
      services: [...config.services, nextService],
    };

    validateConfigConsistency(nextConfig);
    await createServiceConfig(nextService);
    return validateAndApply(nextConfig);
  });
}

export async function updateService(serviceId: string, service: ValidatedServiceConfigInput): Promise<AppConfig> {
  return queueWrite(async () => {
    const config = await readConfigOrThrow();
    const index = config.services.findIndex(existing => existing.id === serviceId);

    if (index === -1) {
      throw new ConfigStoreError(`Service '${serviceId}' not found`, 404, 'SERVICE_NOT_FOUND');
    }

    const nextService = finalizeService(service, serviceId);
    const nextServices = [...config.services];
    nextServices[index] = nextService;

    const nextConfig = {
      ...config,
      services: nextServices,
    };

    validateConfigConsistency(nextConfig);
    await updateServiceConfig(serviceId, nextService);
    return validateAndApply(nextConfig);
  });
}

export async function deleteService(serviceId: string): Promise<AppConfig> {
  return queueWrite(async () => {
    const config = await readConfigOrThrow();

    if (!config.services.some(service => service.id === serviceId)) {
      throw new ConfigStoreError(`Service '${serviceId}' not found`, 404, 'SERVICE_NOT_FOUND');
    }

    const nextConfig = {
      ...config,
      services: config.services.filter(service => service.id !== serviceId),
    };

    await deleteServiceConfig(serviceId);
    return validateAndApply(nextConfig);
  });
}

export async function createAlert(alert: ValidatedAlertChannelInput): Promise<AppConfig> {
  return queueWrite(async () => {
    const config = await readConfigOrThrow();
    const nextAlert = finalizeAlert(alert);
    const nextConfig = {
      ...config,
      alerts: [...config.alerts, nextAlert],
    };

    validateConfigConsistency(nextConfig);
    await createAlertConfig(nextAlert);
    return validateAndApply(nextConfig);
  });
}

export async function updateAlert(alertId: string, alert: ValidatedAlertChannelInput): Promise<AppConfig> {
  return queueWrite(async () => {
    const config = await readConfigOrThrow();
    const index = config.alerts.findIndex(existing => existing.id === alertId);

    if (index === -1) {
      throw new ConfigStoreError(`Alert channel '${alertId}' not found`, 404, 'ALERT_NOT_FOUND');
    }

    const nextAlert = finalizeAlert(alert, alertId);
    const nextAlerts = [...config.alerts];
    nextAlerts[index] = nextAlert;

    const nextConfig = {
      ...config,
      alerts: nextAlerts,
    };

    validateConfigConsistency(nextConfig);
    await updateAlertConfig(alertId, nextAlert);
    return validateAndApply(nextConfig);
  });
}

export async function deleteAlert(alertId: string): Promise<AppConfig> {
  return queueWrite(async () => {
    const config = await readConfigOrThrow();

    if (!config.alerts.some(alert => alert.id === alertId)) {
      throw new ConfigStoreError(`Alert channel '${alertId}' not found`, 404, 'ALERT_NOT_FOUND');
    }

    if (config.services.some(service => (service.alertChannels ?? []).includes(alertId))) {
      throw new ConfigStoreError(
        `Alert channel '${alertId}' is still referenced by one or more services`,
        409,
        'ALERT_IN_USE',
      );
    }

    const nextConfig = {
      ...config,
      alerts: config.alerts.filter(alert => alert.id !== alertId),
    };

    await deleteAlertConfig(alertId);
    return validateAndApply(nextConfig);
  });
}
