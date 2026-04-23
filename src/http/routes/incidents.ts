import { Hono } from 'hono';
import { getRecentIncidents } from '../../db/repos';
import type { ValidatedServiceConfig } from '../../config/schemas';

let services: ValidatedServiceConfig[] = [];
export function setServicesForIncidents(svcs: ValidatedServiceConfig[]) {
  services = svcs;
}

export const incidentsRoute = new Hono();

incidentsRoute.get('/', async (c) => {
  const limitRaw = parseInt(c.req.query('limit') ?? '20', 10);
  const offsetRaw = parseInt(c.req.query('offset') ?? '0', 10);

  if (isNaN(limitRaw) || limitRaw < 1 || limitRaw > 100) {
	return c.json({ error: 'limit must be an integer between 1 and 100' }, 400);
  }
  if (isNaN(offsetRaw) || offsetRaw < 0) {
	return c.json({ error: 'offset must be a non-negative integer' }, 400);
  }

  const { total, incidents } = await getRecentIncidents(limitRaw, offsetRaw);

  const enriched = incidents.map(i => ({
	...i,
	serviceName: services.find(s => s.id === i.serviceId)?.name ?? i.serviceId,
  }));

  return c.json({ total, incidents: enriched });
});


