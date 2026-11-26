import { getState, setState } from './state';
import { insertIncident, resolveIncident, getOpenIncident, getRecentResults } from '../db/repos';
import { bus } from './bus';
import { logger } from '../shared/logger';
import type { CheckResult } from '../shared/types';
import type { ValidatedServiceConfig } from '../config/schemas';

const pending = new Map<string, Promise<void>>();

/** Serializes all incident transitions per service. */
async function enqueue(serviceId: string, task: () => Promise<void>): Promise<void> {
  const previous = pending.get(serviceId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  pending.set(serviceId, next);
  try {
    await next;
  } finally {
    if (pending.get(serviceId) === next) pending.delete(serviceId);
  }
}

export function handleCheckResult(result: CheckResult, service: ValidatedServiceConfig): Promise<void> {
  return enqueue(result.serviceId, () => processCheckResult(result, service));
}

/** Closes a paused or deleted service's open incident without sending a recovery alert. */
export function closeOpenIncident(serviceId: string): Promise<void> {
  return enqueue(serviceId, async () => {
    const incident = await getOpenIncident(serviceId);
    if (incident) {
      const resolvedAt = new Date();
      await resolveIncident(incident.id, resolvedAt, resolvedAt.getTime() - incident.openedAt.getTime());
      logger.info({ serviceId }, 'Incident closed because monitoring stopped');
    }
    setState(serviceId, { activeIncidentId: null, consecutiveFailures: 0, consecutiveSuccesses: 0 });
  });
}

async function processCheckResult(
  result: CheckResult,
  service: ValidatedServiceConfig
): Promise<void> {
  const state = getState(result.serviceId);

  if (result.status === 'up') {
    setState(result.serviceId, {
      consecutiveFailures: 0,
      consecutiveSuccesses: state.consecutiveSuccesses + 1,
      lastStatus: 'up',
    });

    const updated = getState(result.serviceId);
    if (
      state.activeIncidentId &&
      updated.consecutiveSuccesses >= service.successThreshold
    ) {
      const resolvedAt = new Date();
      const incident = await getOpenIncident(result.serviceId);
      if (incident) {
        const duration = resolvedAt.getTime() - incident.openedAt.getTime();
        await resolveIncident(incident.id, resolvedAt, duration);
        const resolved = { ...incident, status: 'resolved' as const, resolvedAt, duration };
        bus.emit('incident.resolved', resolved);
        logger.info({ serviceId: result.serviceId }, 'Incident resolved');
      }
      // Clear even when the row is gone, otherwise no new incident could ever open.
      setState(result.serviceId, { activeIncidentId: null });
    }
  } else {
    setState(result.serviceId, {
      consecutiveSuccesses: 0,
      consecutiveFailures: state.consecutiveFailures + 1,
      lastStatus: 'down',
    });

    const updated = getState(result.serviceId);
    if (
      !state.activeIncidentId &&
      updated.consecutiveFailures >= service.failureThreshold
    ) {
      const incident = {
        serviceId: result.serviceId,
        status: 'open' as const,
        openedAt: new Date(),
        cause: result.error ?? 'Unknown error',
      };
      const id = await insertIncident(incident);
      setState(result.serviceId, { activeIncidentId: id });
      bus.emit('incident.opened', { ...incident, id });
      logger.warn({ serviceId: result.serviceId }, 'Incident opened');
    }
  }
}

export async function rebuildStateFromDb(service: ValidatedServiceConfig): Promise<void> {
  const limit = Math.max(service.failureThreshold, service.successThreshold) + 1;
  const results = await getRecentResults(service.id, limit);

  const openIncident = await getOpenIncident(service.id);
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;

  for (const r of results) {
    if (r.status === results[0]?.status) {
      if (r.status === 'up') consecutiveSuccesses++;
      else consecutiveFailures++;
    } else break;
  }

  setState(service.id, {
    serviceId: service.id,
    consecutiveFailures,
    consecutiveSuccesses,
    activeIncidentId: openIncident?.id ?? null,
    lastStatus: results[0]?.status ?? 'unknown',
  });
}
