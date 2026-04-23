import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';

const baseConfig = {
  services: [
    {
      id: 'svc-1',
      name: 'Service One',
      type: 'http' as const,
      url: 'https://example.com/health',
      interval: 60,
      timeout: 10,
      method: 'GET',
      expectedStatus: 200,
      failureThreshold: 3,
      successThreshold: 2,
      alertChannels: ['alert-1'],
      maintenanceWindows: [],
      alertCooldownMinutes: 0,
    },
  ],
  alerts: [
    {
      id: 'alert-1',
      name: 'Ops Email',
      type: 'email' as const,
      to: ['ops@example.com'],
      method: 'POST',
    },
  ],
};

const listConfig = mock(async () => structuredClone(baseConfig));
const createService = mock(async (service: unknown) => ({ ...structuredClone(baseConfig), services: [...baseConfig.services, service] }));
const updateService = mock(async (id: string, service: unknown) => ({ ...structuredClone(baseConfig), services: baseConfig.services.map(s => (s.id === id ? service : s)) }));
const deleteService = mock(async (id: string) => ({ ...structuredClone(baseConfig), services: baseConfig.services.filter(s => s.id !== id) }));
const createAlert = mock(async (alert: unknown) => ({ ...structuredClone(baseConfig), alerts: [...baseConfig.alerts, alert] }));
const updateAlert = mock(async (id: string, alert: unknown) => ({ ...structuredClone(baseConfig), alerts: baseConfig.alerts.map(a => (a.id === id ? alert : a)) }));
const deleteAlert = mock(async (id: string) => ({ ...structuredClone(baseConfig), alerts: baseConfig.alerts.filter(a => a.id !== id) }));

mock.module('../../src/config/store', () => ({
  listConfig,
  createService,
  updateService,
  deleteService,
  createAlert,
  updateAlert,
  deleteAlert,
}));

import { adminRoute } from '../../src/http/routes/admin';

const app = new Hono();
app.route('/api/admin', adminRoute);

describe('adminRoute', () => {
  beforeEach(() => {
    listConfig.mockClear();
    createService.mockClear();
    updateService.mockClear();
    deleteService.mockClear();
    createAlert.mockClear();
    updateAlert.mockClear();
    deleteAlert.mockClear();
  });

  it('lists config', async () => {
    const res = await app.request('/api/admin/config');
    expect(res.status).toBe(200);
    const body = await res.json() as typeof baseConfig;
    expect(body.services).toHaveLength(1);
    expect(body.alerts).toHaveLength(1);
    expect(listConfig).toHaveBeenCalledTimes(1);
  });

  it('creates a service', async () => {
    const newService = {
      id: 'svc-2',
      name: 'Service Two',
      type: 'http',
      url: 'https://example.com/two',
      interval: 60,
      timeout: 10,
      method: 'GET',
      expectedStatus: 200,
      failureThreshold: 3,
      successThreshold: 2,
      alertChannels: [],
      maintenanceWindows: [],
      alertCooldownMinutes: 0,
    };

    const res = await app.request('/api/admin/services', {
      method: 'POST',
      body: JSON.stringify(newService),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(201);
    expect(createService).toHaveBeenCalledTimes(1);
  });

  it('updates a service', async () => {
    const updated = { ...baseConfig.services[0], name: 'Updated Name' };
    const res = await app.request('/api/admin/services/svc-1', {
      method: 'PUT',
      body: JSON.stringify(updated),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(updateService).toHaveBeenCalledWith('svc-1', updated);
  });

  it('deletes a service', async () => {
    const res = await app.request('/api/admin/services/svc-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(deleteService).toHaveBeenCalledWith('svc-1');
  });

  it('creates an alert', async () => {
    const newAlert = { name: 'Telegram Ops', type: 'telegram', chatId: '123', botToken: 'token' };
    const res = await app.request('/api/admin/alerts', {
      method: 'POST',
      body: JSON.stringify(newAlert),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(201);
    expect(createAlert).toHaveBeenCalledTimes(1);
  });

  it('updates an alert', async () => {
    const updated = { ...baseConfig.alerts[0], name: 'Primary Email', to: ['oncall@example.com'] };
    const res = await app.request('/api/admin/alerts/alert-1', {
      method: 'PUT',
      body: JSON.stringify(updated),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(updateAlert).toHaveBeenCalledWith('alert-1', updated);
  });

  it('deletes an alert', async () => {
    const res = await app.request('/api/admin/alerts/alert-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(deleteAlert).toHaveBeenCalledWith('alert-1');
  });
});
