import { describe, it, expect, mock } from 'bun:test';
import path from 'path';
import { Hono } from 'hono';

const dbBase = path.resolve(import.meta.dir, '../../src/db');

mock.module(path.join(dbBase, 'repos'), () => ({
  getRecentResults: mock(async () => [
    { status: 'up', responseTime: 120, checkedAt: new Date() },
  ]),
  getUptime24h: mock(async () => 99.5),
  getRecentIncidents: mock(async () => ({
    total: 1,
    incidents: [
      { id: 'inc-1', serviceId: 'api-test', status: 'open', openedAt: new Date(), cause: 'timeout' },
    ],
  })),
}));

import { statusRoute, setServices } from '../../src/http/routes/status';
import { incidentsRoute, setServicesForIncidents } from '../../src/http/routes/incidents';
import { historyRoute } from '../../src/http/routes/history';
import { servicesRoute, setServicesForManagement } from '../../src/http/routes/services';
import { setState } from '../../src/monitoring/state';
import { resumeService } from '../../src/monitoring/paused';
import { setSslResult } from '../../src/monitoring/ssl-status';

const testService = {
  id: 'api-test', name: 'Test API', type: 'http' as const,
  url: 'https://example.com', interval: 60, timeout: 10,
  method: 'GET', expectedStatus: 200, failureThreshold: 3,
  successThreshold: 2, alertChannels: [], maintenanceWindows: [], alertCooldownMinutes: 0, sslExpiryWarningDays: 30,
};

setState('api-test', { serviceId: 'api-test', lastStatus: 'up', consecutiveFailures: 0, consecutiveSuccesses: 1, activeIncidentId: null });
setServices([testService]);
setServicesForIncidents([testService]);
setServicesForManagement([testService]);
resumeService('api-test');
setSslResult({
  serviceId: 'api-test',
  hostname: 'example.com',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  daysRemaining: 10,
  checkedAt: new Date('2029-12-20T00:00:00.000Z'),
});

const app = new Hono();
app.route('/api/status', statusRoute);
app.route('/api/incidents', incidentsRoute);
app.route('/api/history', historyRoute);
app.route('/api/services', servicesRoute);

async function get(p: string) { return app.fetch(new Request(`http://localhost${p}`)); }

describe('GET /api/status', () => {
  it('returns 200 with summary', async () => {
    const res = await get('/api/status');
    expect(res.status).toBe(200);
    const body = await res.json() as { summary: { total: number; up: number } };
    expect(body.summary.total).toBe(1);
    expect(body.summary.up).toBe(1);
  });

  it('includes service history array', async () => {
    const res = await get('/api/status');
    const body = await res.json() as { services: Array<{ history: unknown[] }> };
    expect(Array.isArray(body.services[0]?.history)).toBeTrue();
  });

  it('includes ssl warning data when available', async () => {
    const res = await get('/api/status');
    const body = await res.json() as {
      services: Array<{
        sslExpiryWarningDays: number | null;
        sslStatus: null | { hostname: string; daysRemaining: number };
      }>;
    };

    expect(body.services[0]?.sslExpiryWarningDays).toBe(30);
    expect(body.services[0]?.sslStatus?.hostname).toBe('example.com');
    expect(body.services[0]?.sslStatus?.daysRemaining).toBe(10);
  });
});

describe('GET /api/incidents', () => {
  it('returns 200 with incidents array', async () => {
    const res = await get('/api/incidents');
    expect(res.status).toBe(200);
    const body = await res.json() as { incidents: Array<{ serviceName: string }> };
    expect(body.incidents[0]?.serviceName).toBe('Test API');
  });

  it('respects ?limit param', async () => {
    const res = await get('/api/incidents?limit=5');
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid limit', async () => {
    const res = await get('/api/incidents?limit=-1');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/history/:serviceId', () => {
  it('returns results for a service', async () => {
    const res = await get('/api/history/api-test');
    expect(res.status).toBe(200);
    const body = await res.json() as { serviceId: string; results: unknown[] };
    expect(body.serviceId).toBe('api-test');
    expect(Array.isArray(body.results)).toBeTrue();
  });

  it('returns 400 for invalid limit', async () => {
    const res = await get('/api/history/api-test?limit=abc');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/services/:id/pause and /resume', () => {
  it('pauses a service', async () => {
    const res = await app.fetch(new Request('http://localhost/api/services/api-test/pause', { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { paused: boolean };
    expect(body.paused).toBe(true);
  });

  it('resumes a paused service', async () => {
    await app.fetch(new Request('http://localhost/api/services/api-test/pause', { method: 'POST' }));
    const res = await app.fetch(new Request('http://localhost/api/services/api-test/resume', { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { paused: boolean };
    expect(body.paused).toBe(false);
  });

  it('returns 404 for unknown service', async () => {
    const res = await app.fetch(new Request('http://localhost/api/services/does-not-exist/pause', { method: 'POST' }));
    expect(res.status).toBe(404);
  });
});
