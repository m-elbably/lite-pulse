import { isDeepStrictEqual } from 'node:util';
import { runHttpCheck } from './checkers/http';
import { runTcpCheck } from './checkers/tcp';
import { checkSslExpiry } from './checkers/ssl';
import { insertCheckResult } from '../db/repos';
import { handleCheckResult } from './engine';
import { bus } from './bus';
import { logger } from '../shared/logger';
import { isPaused } from './paused';
import { clearSslResult, setSslResult } from './ssl-status';
import type { ValidatedServiceConfig } from '../config/schemas';

interface Job {
  service: ValidatedServiceConfig;
  stopped: boolean;
  timer?: ReturnType<typeof setInterval>;
  sslTimer?: ReturnType<typeof setInterval>;
  check?: Promise<void>;
  sslCheck?: Promise<void>;
}
const jobs = new Map<string, Job>();

async function runCheck(job: Job): Promise<void> {
  const service = job.service;
  if (job.stopped || isPaused(service.id)) return;
  try {
    const result = service.type === 'http' ? await runHttpCheck(service) : await runTcpCheck(service);
    if (job.stopped || isPaused(service.id)) return;
    await insertCheckResult(result);
    if (job.stopped || isPaused(service.id)) return;
    await handleCheckResult(result, service);
    bus.emit('check.completed', result);
  } catch (err: unknown) {
    logger.error({ serviceId: service.id, err: err instanceof Error ? err.message : String(err) }, 'Check failed unexpectedly');
  }
}

async function runSslCheck(job: Job): Promise<void> {
  const service = job.service;
  if (!service.url || !service.sslExpiryWarningDays || job.stopped || isPaused(service.id)) return;
  try {
    const result = await checkSslExpiry(service.id, service.url);
    if (job.stopped || isPaused(service.id)) return;
    setSslResult(result);
    if (result.error) {
      logger.warn({ serviceId: service.id, err: result.error }, 'SSL check error');
    } else if (result.daysRemaining <= service.sslExpiryWarningDays) {
      bus.emit('ssl.expiry.warning', result);
    }
  } catch (err: unknown) {
    logger.error({ serviceId: service.id, err: err instanceof Error ? err.message : String(err) }, 'SSL check failed');
  }
}

function triggerCheck(job: Job): void {
  if (!job.check) job.check = runCheck(job).finally(() => { job.check = undefined; });
}

function triggerSslCheck(job: Job): void {
  if (!job.sslCheck) job.sslCheck = runSslCheck(job).finally(() => { job.sslCheck = undefined; });
}

export async function updateScheduler(services: ValidatedServiceConfig[]): Promise<void> {
  const next = new Map(services.map(service => [service.id, service]));
  const stopping: Job[] = [];
  for (const [id, job] of jobs) {
    if (isDeepStrictEqual(job.service, next.get(id))) continue;
    job.stopped = true;
    clearInterval(job.timer);
    clearInterval(job.sslTimer);
    jobs.delete(id);
    clearSslResult(id);
    stopping.push(job);
  }
  // Drain processing before callers remove runtime state or replace a service.
  await Promise.all(stopping.flatMap(job => [job.check, job.sslCheck]));
  for (const service of services) {
    if (jobs.has(service.id)) continue;
    const job: Job = { service, stopped: false };
    jobs.set(service.id, job);
    job.timer = setInterval(() => triggerCheck(job), service.interval * 1000);
    triggerCheck(job);
    if (service.url && service.sslExpiryWarningDays) {
      job.sslTimer = setInterval(() => triggerSslCheck(job), 24 * 60 * 60 * 1000);
      triggerSslCheck(job);
    }
  }
  logger.info({ count: services.length }, 'Scheduler updated');
}

export const initScheduler = updateScheduler;
export async function stopAll(): Promise<void> { await updateScheduler([]); }
