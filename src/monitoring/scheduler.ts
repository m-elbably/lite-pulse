import { runHttpCheck } from './checkers/http';
import { runTcpCheck } from './checkers/tcp';
import { checkSslExpiry } from './checkers/ssl';
import { insertCheckResult } from '../db/repos';
import { handleCheckResult } from './engine';
import { bus } from './bus';
import { logger } from '../shared/logger';
import { isPaused } from './paused';
import { setSslResult } from './ssl-status';
import type { ValidatedServiceConfig } from '../config/schemas';

type IntervalMap = Map<string, ReturnType<typeof setInterval>>;
type TimeoutMap = Map<string, ReturnType<typeof setTimeout>>;

const timers: IntervalMap = new Map();
const sslIntervals: IntervalMap = new Map();
const sslStartupTimeouts: TimeoutMap = new Map();
let currentServices: ValidatedServiceConfig[] = [];

// ── Uptime check ─────────────────────────────────────────────────────────────

async function runCheck(service: ValidatedServiceConfig): Promise<void> {
  if (isPaused(service.id)) {
    logger.debug({ serviceId: service.id }, 'Check skipped — service paused');
    return;
  }

  try {
    const result = service.type === 'http'
      ? await runHttpCheck(service)
      : await runTcpCheck(service);

    await insertCheckResult(result);
    bus.emit('check.completed', result);
    await handleCheckResult(result, service);

    logger.debug({ serviceId: service.id, status: result.status, ms: result.responseTime }, 'Check done');
  } catch (err: unknown) {
    logger.error({ serviceId: service.id, err: err instanceof Error ? err.message : String(err) }, 'Check failed unexpectedly');
  }
}

// ── SSL expiry check ─────────────────────────────────────────────────────────

/** Check once and emit a warning if cert expires within the configured threshold. */
async function runSslCheck(service: ValidatedServiceConfig): Promise<void> {
  if (!service.url || !service.sslExpiryWarningDays || isPaused(service.id)) {
    return;
  }

  try {
    const result = await checkSslExpiry(service.id, service.url);
    setSslResult(result); // always persist so the dashboard can show current SSL status

    if (result.error) {
      logger.warn({ serviceId: service.id, err: result.error }, 'SSL check error');
      return;
    }

    logger.debug({ serviceId: service.id, daysRemaining: result.daysRemaining }, 'SSL check done');

    if (result.daysRemaining <= service.sslExpiryWarningDays) {
      bus.emit('ssl.expiry.warning', result);
      logger.warn({ serviceId: service.id, daysRemaining: result.daysRemaining }, 'SSL expiry warning emitted');
    }
  } catch (err: unknown) {
    logger.error({ serviceId: service.id, err: err instanceof Error ? err.message : String(err) }, 'SSL check failed');
  }
}

// ── Timer management ─────────────────────────────────────────────────────────

function startTimer(service: ValidatedServiceConfig): void {
  stopTimer(service.id);
  stopSslTimer(service.id);

  void runCheck(service);
  timers.set(service.id, setInterval(() => void runCheck(service), service.interval * 1000));

  if (service.sslExpiryWarningDays && service.url) {
    void runSslCheck(service);

    const startupTimeout = setTimeout(() => {
      sslStartupTimeouts.delete(service.id);
      sslIntervals.set(service.id, setInterval(() => void runSslCheck(service), 24 * 60 * 60 * 1000));
    }, 0);

    sslStartupTimeouts.set(service.id, startupTimeout);
  }
}

function stopTimer(serviceId: string): void {
  const timer = timers.get(serviceId);
  if (timer) {
    clearInterval(timer);
    timers.delete(serviceId);
  }
}

function stopSslTimer(serviceId: string): void {
  const startupTimeout = sslStartupTimeouts.get(serviceId);
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    sslStartupTimeouts.delete(serviceId);
  }

  const interval = sslIntervals.get(serviceId);
  if (interval) {
    clearInterval(interval);
    sslIntervals.delete(serviceId);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initScheduler(services: ValidatedServiceConfig[]): void {
  currentServices = services;
  for (const service of services) {
    startTimer(service);
  }
  logger.info({ count: services.length }, 'Scheduler started');
}

export function updateScheduler(newServices: ValidatedServiceConfig[]): void {
  const oldIds = new Set(currentServices.map(service => service.id));
  const newIds = new Set(newServices.map(service => service.id));

  for (const id of oldIds) {
    if (!newIds.has(id)) {
      stopTimer(id);
      stopSslTimer(id);
    }
  }

  for (const service of newServices) {
    startTimer(service);
  }

  currentServices = newServices;
  logger.info({ count: newServices.length }, 'Scheduler updated');
}

export function stopAll(): void {
  for (const id of timers.keys()) {
    stopTimer(id);
    stopSslTimer(id);
  }
}
