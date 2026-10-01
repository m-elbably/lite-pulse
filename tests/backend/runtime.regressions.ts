import assert from 'node:assert/strict';
import tls from 'node:tls';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { createRenderer, createSSRApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, routerKey } from 'vue-router';
import { renderToString } from '@vue/server-renderer';
import { compileScript, parse } from '@vue/compiler-sfc';
import { app, updateApiServices } from '../../src/http/server';
import { SESSION_MAX_AGE, loginAdmin, isAdminSession, loginStatus } from '../../src/http/auth';
import { SqliteAdapter } from '../../src/db/adapters/sqlite';
import { MongoAdapter } from '../../src/db/adapters/mongo';
import { setAdapter } from '../../src/db/adapter';
import { ServiceConfigSchema, AlertChannelSchema } from '../../src/config/schemas';
import { updateService } from '../../src/config/store';
import { handleCheckResult } from '../../src/monitoring/engine';
import { initScheduler, updateScheduler, stopAll } from '../../src/monitoring/scheduler';
import { getAllStates, removeState, setState } from '../../src/monitoring/state';
import { isPaused } from '../../src/monitoring/paused';
import { isInMaintenance } from '../../src/monitoring/maintenance';
import { checkSslExpiry } from '../../src/monitoring/checkers/ssl';
import { dispatch, flushSuppressedAlert, getDeliveryStatuses, testAlertChannel, updateDispatcher } from '../../src/alerts/dispatcher';
import { resetCooldown } from '../../src/alerts/cooldown';
import { useAuth } from '../../web/src/composables/useAuth';
import { useDashboard } from '../../web/src/composables/useDashboard';

const service = ServiceConfigSchema.parse({
  id: 'regression', name: 'Regression', type: 'http', url: 'https://example.test:8443',
  interval: 30, timeout: 1, failureThreshold: 1, successThreshold: 1,
});
const result = { serviceId: service.id, status: 'down' as const, responseTime: 10, checkedAt: new Date(), error: 'unavailable' };
const sqlite = new SqliteAdapter(':memory:');
await sqlite.connect();
await sqlite.ensureSchema();
await sqlite.createService(service);
setAdapter(sqlite);
updateApiServices([service]);
const rawDb = (sqlite as unknown as { db: Database }).db;

// Protected status pages reject forged and disabled-role tokens.
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'secret';
delete process.env.STATUS_USERNAME;
delete process.env.STATUS_PASSWORD;
process.env.PUBLIC_STATUS_PAGE = 'false';
assert.equal((await app.request('/api/status', { headers: { Cookie: 'vigil_status_session=forged' } })).status, 401);
assert.equal(loginStatus('any', 'any'), null);
const token = loginAdmin('admin', 'secret')!;
const adminHeaders = { Cookie: `vigil_admin_session=${token}`, 'Content-Type': 'application/json' };
assert.equal((await app.request('/api/status', { headers: adminHeaders })).status, 200);
assert.equal((await app.request('/api/auth/admin/login', { method: 'POST', body: '{bad' })).status, 400);
assert.equal((await app.request('/api/auth/admin/login', { method: 'POST', body: JSON.stringify({ username: [], password: 'secret' }) })).status, 400);
const secureLogin = await app.request('https://localhost/api/auth/admin/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'secret' }),
});
assert.match(secureLogin.headers.get('set-cookie')!, /Secure/);
const originalNow = Date.now;
Date.now = () => originalNow() + SESSION_MAX_AGE * 1000 + 1;
assert.equal(isAdminSession(token), false);
Date.now = originalNow;
const activeToken = loginAdmin('admin', 'secret')!;
adminHeaders.Cookie = `vigil_admin_session=${activeToken}`;
delete process.env.ADMIN_USERNAME;
delete process.env.ADMIN_PASSWORD;
process.env.STATUS_USERNAME = 'viewer';
process.env.STATUS_PASSWORD = 'secret';
assert.equal((await app.request('/api/status', { headers: { Cookie: 'vigil_admin_session=forged' } })).status, 401);
assert.equal((await app.request('/api/auth/me')).status, 200);
const statusOnly = await (await app.request('/api/auth/me')).json() as { statusViewer: boolean; admin: boolean };
assert.equal(statusOnly.statusViewer, false);
assert.equal(statusOnly.admin, true); // Explicitly disabled admin auth does not grant status access.
delete process.env.STATUS_USERNAME;
delete process.env.STATUS_PASSWORD;

// Real SQLite processing serializes concurrent incident transitions.
await Promise.all([handleCheckResult(result, service), handleCheckResult(result, service)]);
assert.equal((await sqlite.getRecentIncidents(10, 0)).total, 1);
await Promise.all([
  handleCheckResult({ ...result, status: 'up' }, service),
  handleCheckResult({ ...result, status: 'up' }, service),
]);
assert.equal(await sqlite.getOpenIncident(service.id), null);
removeState(service.id);
assert.equal(await sqlite.getUptime24h('empty'), null);
await sqlite.insertCheckResult({ ...result, status: 'up' });
await sqlite.insertCheckResult(result);
await sqlite.insertCheckResult({ ...result, checkedAt: new Date(Date.now() - 25 * 3600_000) });
assert.equal(await sqlite.getUptime24h(service.id), 50);
rawDb.exec('PRAGMA query_only=ON');
await assert.rejects(sqlite.insertCheckResult(result), /readonly/);
rawDb.exec('PRAGMA query_only=OFF');

// Mongo propagates write errors and computes percentages from aggregate counts.
const mongo = new MongoAdapter();
Object.assign(mongo, { db: { collection: () => ({
  insertOne: async () => { throw new Error('database unavailable'); },
  aggregate: () => ({ toArray: async () => [{ total: 4, up: 3 }] }),
}) } });
await assert.rejects(mongo.insertCheckResult(result), /database unavailable/);
assert.equal(await mongo.getUptime24h(service.id), 75);

// Weekday windows belong to their starting date, including multi-day windows.
const windows = [{ weekdays: [1], startHour: 23, startMinute: 0, durationMinutes: 120 }];
assert.equal(isInMaintenance(windows, new Date(2026, 9, 5, 0, 30)), false);
assert.equal(isInMaintenance(windows, new Date(2026, 9, 5, 23, 30)), true);
assert.equal(isInMaintenance(windows, new Date(2026, 9, 6, 0, 30)), true);
assert.equal(isInMaintenance([{ ...windows[0]!, durationMinutes: 3000 }], new Date(2026, 9, 7, 12)), true);
assert.equal(ServiceConfigSchema.safeParse({ ...service, url: 'ftp://example.test' }).success, false);
assert.equal(ServiceConfigSchema.safeParse({ ...service, url: 'invalid', sslExpiryWarningDays: 14 }).success, false);
assert.equal(ServiceConfigSchema.safeParse({ ...service, expectedStatus: 999 }).success, false);
assert.equal(ServiceConfigSchema.safeParse({ ...service, method: 'INVALID' }).success, false);
assert.equal(AlertChannelSchema.safeParse({ id: 'webhook', name: 'Webhook', type: 'webhook', url: 'https://example.test', method: 'GET' }).success, false);

// Read legacy SQLite services idempotently, and retain pauses across reopening.
rawDb.exec('ALTER TABLE services DROP COLUMN paused');
await sqlite.ensureSchema();
await sqlite.ensureSchema();
assert.equal((await sqlite.listServices())[0]?.paused, false);
const temporary = mkdtempSync(join(tmpdir(), 'litepulse-regressions-'));
try {
  const file = join(temporary, 'pause.db');
  const first = new SqliteAdapter(file);
  await first.connect(); await first.ensureSchema(); await first.createService(service);
  await first.setServicePaused(service.id, true);
  (first as unknown as { db: Database }).db.close();
  const second = new SqliteAdapter(file);
  await second.connect(); await second.ensureSchema();
  assert.equal((await second.listServices())[0]?.paused, true);
  setAdapter(second);
  await updateService(service.id, { ...service, name: 'Edited while paused' });
  assert.equal((await second.listServices())[0]?.paused, true);
  (second as unknown as { db: Database }).db.close();
} finally { rmSync(temporary, { recursive: true }); setAdapter(sqlite); }
await app.request(`/api/services/${service.id}/pause`, { method: 'POST' });
assert.equal((await sqlite.listServices())[0]?.paused, true);
assert.equal(isPaused(service.id), true);
await app.request(`/api/services/${service.id}/resume`, { method: 'POST' });
assert.equal((await sqlite.listServices())[0]?.paused, false);

// SSL checks use the URL's actual port, without any external connection.
const originalConnect = tls.connect;
let port: number | undefined;
Object.assign(tls, { connect: (options: { port: number }, callback: () => void) => {
  port = options.port;
  queueMicrotask(callback);
  return { getPeerCertificate: () => ({ valid_to: 'Jan 1 00:00:00 2030 GMT' }), destroy() {}, setTimeout() {}, on() {} };
} });
await checkSslExpiry(service.id, service.url!);
assert.equal(port, 8443);
tls.connect = originalConnect;

// An unchanged config does not start new checks; deletion drains and discards old work.
const originalFetch = globalThis.fetch;
const responses: Array<(value: Response) => void> = [];
globalThis.fetch = (() => new Promise<Response>(resolve => responses.push(resolve))) as unknown as typeof fetch;
await initScheduler([service]);
await updateScheduler([structuredClone(service)]);
assert.equal(responses.length, 1);
const stopping = updateScheduler([]);
responses[0]!(new Response('', { status: 503 }));
await stopping;
removeState(service.id);
assert.equal((await sqlite.getRecentResults(service.id, 10)).length, 3);
assert.equal(getAllStates().some(state => state.serviceId === service.id), false);
// Storage failure leaves runtime status untouched.
rawDb.exec('PRAGMA query_only=ON');
globalThis.fetch = (async () => new Response('', { status: 200 })) as unknown as typeof fetch;
await initScheduler([service]);
await Bun.sleep(5);
assert.equal(getAllStates().some(state => state.serviceId === service.id), false);
await stopAll();
rawDb.exec('PRAGMA query_only=OFF');

// Unknown/stale services never contribute to a healthy summary; empty uptime is null.
updateApiServices([{ ...service, id: 'empty' }]);
let status = await (await app.request('/api/status')).json() as { summary: { up: number; unknown: number; stale: number }; services: Array<{ uptime24h: number | null; status: string }> };
assert.equal(status.summary.up, 0);
assert.equal(status.summary.unknown, 1);
assert.equal(status.services[0]?.uptime24h, null);
await sqlite.insertCheckResult({ ...result, serviceId: 'stale', status: 'up', checkedAt: new Date(Date.now() - 120_000) });
setState('stale', { lastStatus: 'up' });
updateApiServices([{ ...service, id: 'stale' }]);
status = await (await app.request('/api/status')).json() as typeof status;
assert.equal(status.summary.up, 0);
assert.equal(status.summary.stale, 1);

// Suppressed incidents catch up once, recovery does not reset the flapping cooldown.
const channel = AlertChannelSchema.parse({ id: 'telegram', name: 'Telegram', type: 'telegram', chatId: 'test', botToken: 'test' });
const allDay = [{ startHour: 0, startMinute: 0, durationMinutes: 1440 }];
const alertService = { ...service, name: 'API <&>', alertChannels: [channel.id], maintenanceWindows: allDay, alertCooldownMinutes: 60 };
const incidentId = await sqlite.insertIncident({ ...result, openedAt: new Date(), status: 'open', cause: 'Failure <&>' });
const incident = (await sqlite.getOpenIncident(service.id))!;
assert.equal(incident.id, incidentId);
let sent = 0;
let payload: { text: string; parse_mode?: string } | undefined;
globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
  sent++;
  assert.ok(init?.signal);
  payload = JSON.parse(String(init?.body));
  return Response.json({ ok: true });
}) as unknown as typeof fetch;
resetCooldown(service.id);
updateDispatcher([channel], [alertService]);
await dispatch('incident.opened', incident);
assert.equal(sent, 0);
updateDispatcher([channel], [{ ...alertService, maintenanceWindows: [] }]);
await flushSuppressedAlert(service.id);
await flushSuppressedAlert(service.id);
assert.equal(sent, 1);
assert.ok(payload?.text.includes('API <&>'));
assert.equal(payload?.parse_mode, undefined);
assert.ok(getDeliveryStatuses()[channel.id]?.lastSuccessAt);
await dispatch('incident.resolved', { ...incident, status: 'resolved', resolvedAt: new Date() });
await dispatch('incident.opened', incident);
assert.equal(sent, 2); // One outage and one recovery, no flapping outage notification.
await testAlertChannel(channel);
assert.equal(sent, 3);
assert.ok(payload?.text.includes('test notification'));
const webhook = AlertChannelSchema.parse({ id: 'webhook', name: 'Webhook', type: 'webhook', url: 'https://example.test/alerts' });
await testAlertChannel(webhook);
assert.ok(getDeliveryStatuses()[webhook.id]?.lastSuccessAt);
globalThis.fetch = (async () => new Response('unavailable', { status: 503 })) as unknown as typeof fetch;
await assert.rejects(testAlertChannel(channel), /503/);
assert.match(getDeliveryStatuses()[channel.id]?.error ?? '', /503/);
assert.equal(getDeliveryStatuses()[channel.id]?.pending, false);
assert.equal((await app.request('/api/admin/alerts/unknown/test', { method: 'POST' })).status, 404);
await sqlite.createAlert(channel);
const failedTest = await app.request(`/api/admin/alerts/${channel.id}/test`, { method: 'POST' });
assert.equal(failedTest.status, 502);
const deliveryResponse = await (await app.request('/api/admin/alerts/delivery')).json() as { channels: Record<string, { error: string }> };
assert.match(deliveryResponse.channels[channel.id]!.error, /503/);
globalThis.fetch = (async () => Response.json({ ok: true })) as unknown as typeof fetch;
assert.equal((await app.request(`/api/admin/alerts/${channel.id}/test`, { method: 'POST' })).status, 200);

// Auth request failures are retryable.
let attempts = 0;
globalThis.fetch = (async () => {
  if (++attempts === 1) throw new Error('temporary network failure');
  return Response.json({ admin: false, statusViewer: false, publicStatus: false, adminAuthEnabled: true, statusAuthEnabled: true });
}) as unknown as typeof fetch;
const auth = useAuth();
await assert.rejects(auth.fetchAuthState());
await auth.fetchAuthState();
assert.equal(attempts, 2);

// Vue lifecycle check: unmount cancels polling and requests, and refreshes do not overlap.
const pendingFetches: Array<(value: Response) => void> = [];
const signals: AbortSignal[] = [];
globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
  signals.push(init!.signal!);
  return new Promise<Response>(resolve => pendingFetches.push(resolve));
}) as unknown as typeof fetch;
let starts = 0, clears = 0;
Object.assign(globalThis, { window: { setInterval: () => { starts++; return 1; }, clearInterval: () => { clears++; } } });
type Node = Record<string, unknown>;
const renderer = createRenderer<Node, Node>({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
  insert() {}, remove() {}, patchProp() {},
});
const router = createRouter({ history: createMemoryHistory(), routes: [] });
let dashboard: ReturnType<typeof useDashboard> | undefined;
const mounted = renderer.createApp(defineComponent({ setup() { dashboard = useDashboard(); return () => h('div'); } }));
mounted.provide(routerKey, router);
mounted.mount({});
await dashboard!.refresh();
assert.equal(pendingFetches.length, 2);
mounted.unmount();
pendingFetches[0]!(Response.json({ services: [] }));
pendingFetches[1]!(Response.json({ incidents: [] }));
await Bun.sleep(5);
assert.equal(starts, 1);
assert.equal(clears, 1);
assert.ok(signals.every(signal => signal.aborted));
assert.equal(dashboard!.services.value.length, 0);
globalThis.fetch = originalFetch;

// Render the actual status banner for healthy, unknown, loading, offline, and paused states.
const { descriptor } = parse(await Bun.file(join(import.meta.dir, '../../web/src/components/dashboard/StatusBanner.vue')).text());
const compiled = compileScript(descriptor, { id: 'status-banner', inlineTemplate: true });
const code = new Bun.Transpiler({ loader: 'ts' }).transformSync(compiled.content)
  .replaceAll('from "vue"', `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  .replaceAll("from 'vue'", `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  .replaceAll("from 'lucide-vue-next'", `from ${JSON.stringify(import.meta.resolve('lucide-vue-next'))}`);
const { default: banner } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const summary = { total: 1, up: 1, down: 0, unknown: 0, paused: 0, stale: 0 };
assert.match(await renderToString(createSSRApp(banner, { summary, loading: false, offline: false })), /All systems operational/);
for (const props of [
  { summary, loading: true, offline: false }, { summary, loading: false, offline: true },
  { summary: { ...summary, up: 0, unknown: 1 }, loading: false, offline: false },
  { summary: { ...summary, up: 0, paused: 1 }, loading: false, offline: false },
  { summary: { ...summary, total: 0, up: 0 }, loading: false, offline: false },
]) assert.doesNotMatch(await renderToString(createSSRApp(banner, props)), /All systems operational/);
console.log('runtime regressions passed');
