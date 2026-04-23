import { Hono } from 'hono';
import { pauseService, resumeService, isPaused } from '../../monitoring/paused';
import type { ValidatedServiceConfig } from '../../config/schemas';

let services: ValidatedServiceConfig[] = [];
export function setServicesForManagement(svcs: ValidatedServiceConfig[]) {
  services = svcs;
}

export const servicesRoute = new Hono();

servicesRoute.get('/', (c) => {
  const list = services.map(s => ({
	id: s.id,
	name: s.name,
	type: s.type,
	paused: isPaused(s.id),
  }));
  return c.json({ services: list });
});

servicesRoute.post('/:id/pause', (c) => {
  const id = c.req.param('id');
  if (!services.find(s => s.id === id)) {
	return c.json({ error: `Service '${id}' not found` }, 404);
  }
  pauseService(id);
  return c.json({ id, paused: true });
});

servicesRoute.post('/:id/resume', (c) => {
  const id = c.req.param('id');
  if (!services.find(s => s.id === id)) {
	return c.json({ error: `Service '${id}' not found` }, 404);
  }
  resumeService(id);
  return c.json({ id, paused: false });
});


