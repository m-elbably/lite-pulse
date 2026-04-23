import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requireAdminSession, requireStatusSession } from './auth';
import { authRoute } from './routes/auth';
import { statusRoute, setServices } from './routes/status';
import { incidentsRoute, setServicesForIncidents } from './routes/incidents';
import { historyRoute } from './routes/history';
import { servicesRoute, setServicesForManagement } from './routes/services';
import { adminRoute } from './routes/admin';
import { dashboardRoute } from './dashboard';
import { logger } from '../shared/logger';
import type { ValidatedServiceConfig } from '../config/schemas';

export const app = new Hono();

app.use('*', secureHeaders());

const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
app.use('/api/*', cors({ origin: allowedOrigin, credentials: true }));

app.route('/api/auth', authRoute);

app.use('/api/status/*', requireStatusSession());
app.use('/api/incidents/*', requireStatusSession());
app.use('/api/history/*', requireStatusSession());

app.use('/api/services/*', requireAdminSession());
app.use('/api/admin/*', requireAdminSession());

app.route('/api/status', statusRoute);
app.route('/api/incidents', incidentsRoute);
app.route('/api/history', historyRoute);
app.route('/api/services', servicesRoute);
app.route('/api/admin', adminRoute);
app.route('/', dashboardRoute);

export function updateApiServices(services: ValidatedServiceConfig[]) {
  setServices(services);
  setServicesForIncidents(services);
  setServicesForManagement(services);
}

export function startServer(port: number) {
  logger.info({ port }, 'HTTP server starting');
  return Bun.serve({ fetch: app.fetch, port });
}

