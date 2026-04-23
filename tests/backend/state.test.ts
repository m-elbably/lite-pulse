import { describe, it, expect, beforeEach } from 'bun:test';
import { getState, setState, removeState, getAllStates } from '../../src/monitoring/state';


function cleanup(...ids: string[]) {
  for (const id of ids) removeState(id);
}

describe('state', () => {
  beforeEach(() => cleanup('svc-1', 'svc-2'));

  it('returns default state for unknown service', () => {
    const s = getState('svc-1');
    expect(s.lastStatus).toBe('unknown');
    expect(s.consecutiveFailures).toBe(0);
    expect(s.consecutiveSuccesses).toBe(0);
    expect(s.activeIncidentId).toBeNull();
  });

  it('sets and retrieves state', () => {
    setState('svc-1', { lastStatus: 'down', consecutiveFailures: 2 });
    expect(getState('svc-1').lastStatus).toBe('down');
    expect(getState('svc-1').consecutiveFailures).toBe(2);
  });

  it('merges patch into existing state', () => {
    setState('svc-1', { consecutiveFailures: 3 });
    setState('svc-1', { consecutiveSuccesses: 1 });
    const s = getState('svc-1');
    expect(s.consecutiveFailures).toBe(3);
    expect(s.consecutiveSuccesses).toBe(1);
  });

  it('removes state', () => {
    setState('svc-1', { lastStatus: 'up' });
    removeState('svc-1');
    expect(getState('svc-1').lastStatus).toBe('unknown');
  });

  it('getAllStates includes all tracked services', () => {
    setState('svc-1', { lastStatus: 'up' });
    setState('svc-2', { lastStatus: 'down' });
    const ids = getAllStates().map(s => s.serviceId);
    expect(ids).toContain('svc-1');
    expect(ids).toContain('svc-2');
  });
});
