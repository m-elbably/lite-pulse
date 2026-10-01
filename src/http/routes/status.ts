import { Hono } from 'hono';
import { getState } from '../../monitoring/state';
import { getRecentResults, getUptime24h } from '../../db/repos';
import { isPaused } from '../../monitoring/paused';
import { getSslResult } from '../../monitoring/ssl-status';
import type { ValidatedServiceConfig } from '../../config/schemas';

let services: ValidatedServiceConfig[] = [];

export function setServices(svcs: ValidatedServiceConfig[]) {
  services = svcs;
}

export const statusRoute = new Hono();

statusRoute.get('/', async (c) => {
  const serviceList = await Promise.all(services.map(async s => {
	const state = getState(s.id);
	const recent = await getRecentResults(s.id, 60);
	const uptime24h = await getUptime24h(s.id);
	const last = recent[0];
    const paused = isPaused(s.id);
    const stale = !paused && !!last && Date.now() - last.checkedAt.getTime() > (s.interval * 2 + s.timeout) * 1000;
    const status = stale || !last ? 'unknown' : state.lastStatus;

	return {
	  id: s.id,
	  name: s.name,
	  status,
      stale,
	  responseTime: last?.responseTime ?? null,
	  lastCheckedAt: last?.checkedAt ?? null,
	  uptime24h,
	  activeIncident: state.activeIncidentId ? { id: state.activeIncidentId } : null,
	  paused,
	  sslExpiryWarningDays: s.sslExpiryWarningDays ?? null,
	  history: recent.slice(0, 60).map(r => ({ status: r.status, responseTime: r.responseTime, checkedAt: r.checkedAt })).reverse(),
	  sslStatus: getSslResult(s.id) ?? null,
	};
  }));

  const up = serviceList.filter(s => !s.paused && s.status === 'up').length;
  const down = serviceList.filter(s => !s.paused && s.status === 'down').length;

  return c.json({
	generatedAt: new Date(),
	summary: { total: serviceList.length, up, down,
      unknown: serviceList.filter(s => !s.paused && s.status === 'unknown').length,
      paused: serviceList.filter(s => s.paused).length,
      stale: serviceList.filter(s => s.stale).length,
    },
	services: serviceList,
  });
});


