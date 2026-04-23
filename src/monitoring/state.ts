import type { ServiceState } from '../shared/types';

const states = new Map<string, ServiceState>();

export function getState(serviceId: string): ServiceState {
  if (!states.has(serviceId)) {
    states.set(serviceId, {
      serviceId,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      activeIncidentId: null,
      lastStatus: 'unknown',
    });
  }
  return states.get(serviceId)!;
}

export function setState(serviceId: string, patch: Partial<ServiceState>): void {
  const current = getState(serviceId);
  states.set(serviceId, { ...current, ...patch });
}

export function removeState(serviceId: string): void {
  states.delete(serviceId);
}

export function getAllStates(): ServiceState[] {
  return Array.from(states.values());
}
