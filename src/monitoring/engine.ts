import { getState, setState } from './state';
import { insertIncident, resolveIncident, getOpenIncident, getRecentResults } from '../db/repos';
import { bus } from './bus';
import { logger } from '../shared/logger';
import type { CheckResult } from '../shared/types';
import type { ValidatedServiceConfig } from '../config/schemas';

const pending = new Map<string, Promise<void>>();

export async function handleCheckResult(result: CheckResult, service: ValidatedServiceConfig): Promise<void> {
  const previous = pending.get(result.serviceId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => processCheckResult(result, service));
  pending.set(result.serviceId, next);
  try {
    await next;
  } finally {
    if (pending.get(result.serviceId) === next) pending.delete(result.serviceId);
  }
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
        setState(result.serviceId, { activeIncidentId: null });
        const resolved = { ...incident, status: 'resolved' as const, resolvedAt, duration };
        bus.emit('incident.resolved', resolved);
        logger.info({ serviceId: result.serviceId }, 'Incident resolved');
      }
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
