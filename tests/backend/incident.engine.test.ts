import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockInsertIncident = mock(async () => 'incident-id-1');
const mockResolveIncident = mock(async () => {});
const mockGetOpenIncident = mock(async (_id: string) => null as null | { id: string; serviceId: string; status: 'open'; openedAt: Date; cause: string });
const mockGetRecentResults = mock(async () => []);

mock.module('../../src/db/repos', () => ({
  insertIncident: mockInsertIncident,
  resolveIncident: mockResolveIncident,
  getOpenIncident: mockGetOpenIncident,
  getRecentResults: mockGetRecentResults,
}));

const emitted: Array<{ event: string; payload: unknown }> = [];
mock.module('../../src/monitoring/bus', () => ({
  bus: {
    emit: (event: string, payload: unknown) => { emitted.push({ event, payload }); },
    on: () => {},
  },
}));

import { handleCheckResult } from '../../src/monitoring/engine';
import { setState, removeState } from '../../src/monitoring/state';

const service = {
  id: 'svc-test',
  name: 'Test',
  type: 'http' as const,
  url: 'https://example.com',
  interval: 60,
  timeout: 10,
  method: 'GET',
  expectedStatus: 200,
  failureThreshold: 2,
  successThreshold: 2,
  alertChannels: [],
  maintenanceWindows: [],
  alertCooldownMinutes: 0,
};

const upResult = { serviceId: 'svc-test', status: 'up' as const, responseTime: 100, checkedAt: new Date() };
const downResult = { serviceId: 'svc-test', status: 'down' as const, responseTime: 0, checkedAt: new Date(), error: 'timeout' };

describe('handleCheckResult', () => {
  beforeEach(() => {
    removeState('svc-test');
    emitted.length = 0;
    mockInsertIncident.mockClear();
    mockResolveIncident.mockClear();
    mockGetOpenIncident.mockClear();
  });

  it('increments consecutiveSuccesses on up result', async () => {
    await handleCheckResult(upResult, service);
    const { consecutiveSuccesses, consecutiveFailures } = (await import('../../src/monitoring/state')).getState('svc-test');
    expect(consecutiveSuccesses).toBe(1);
    expect(consecutiveFailures).toBe(0);
  });

  it('increments consecutiveFailures on down result', async () => {
    await handleCheckResult(downResult, service);
    const { consecutiveFailures } = (await import('../../src/monitoring/state')).getState('svc-test');
    expect(consecutiveFailures).toBe(1);
  });

  it('opens an incident after failureThreshold consecutive failures', async () => {
    await handleCheckResult(downResult, service);
    await handleCheckResult(downResult, service);
    expect(mockInsertIncident).toHaveBeenCalledTimes(1);
    expect(emitted.find(e => e.event === 'incident.opened')).toBeTruthy();
  });

  it('does not open a second incident while one is active', async () => {
    setState('svc-test', { activeIncidentId: 'existing-id', consecutiveFailures: 2 });
    await handleCheckResult(downResult, service);
    expect(mockInsertIncident).not.toHaveBeenCalled();
  });

  it('resolves incident after successThreshold consecutive successes', async () => {
    const openedAt = new Date(Date.now() - 5000);
    setState('svc-test', { activeIncidentId: 'incident-id-1', consecutiveSuccesses: 0 });
    mockGetOpenIncident.mockResolvedValueOnce({
      id: 'incident-id-1',
      serviceId: 'svc-test',
      status: 'open',
      openedAt,
      cause: 'timeout',
    });
    await handleCheckResult(upResult, service);
    await handleCheckResult(upResult, service);
    expect(mockResolveIncident).toHaveBeenCalledTimes(1);
    expect(emitted.find(e => e.event === 'incident.resolved')).toBeTruthy();
  });

  it('resets failure streak on success', async () => {
    await handleCheckResult(downResult, service);
    await handleCheckResult(upResult, service);
    const { consecutiveFailures } = (await import('../../src/monitoring/state')).getState('svc-test');
    expect(consecutiveFailures).toBe(0);
  });
});
