import './shared/env';
import { connectDb, ensureIndexes } from './db/client';
import { getAdapter } from './db/adapter';
import { setConfigApplier } from './config/runtime';
import { listConfig } from './config/store';
import { closeOpenIncident, rebuildStateFromDb } from './monitoring/engine';
import { removeState } from './monitoring/state';
import { initScheduler, stopAll, updateScheduler } from './monitoring/scheduler';
import { initDispatcher, updateDispatcher } from './alerts/dispatcher';
import { startServer, updateApiServices } from './http/server';
import { deleteOldResults } from './db/repos';
import { resetCooldown } from './alerts/cooldown';
import { logger } from './shared/logger';
import { pauseService, resumeService } from './monitoring/paused';
import { getAdminAuthConfig, getStatusAuthConfig } from './http/auth';
import { clearSslResult } from './monitoring/ssl-status';
import type { AppConfig } from './config/types';

function checkAuthConfig(): void {
  const admin = getAdminAuthConfig();
  const status = getStatusAuthConfig();
  for (const [label, config] of [['ADMIN', admin], ['STATUS', status]] as const) {
    if (config?.password === 'change-me') {
      throw new Error(`${label}_PASSWORD is still the example value 'change-me'; set a real password`);
    }
  }
  if (!admin) {
    const log = process.env.NODE_ENV === 'production' ? logger.error.bind(logger) : logger.warn.bind(logger);
    log('Admin authentication is DISABLED: anyone who can reach this server can edit services and read alert secrets. Set ADMIN_USERNAME and ADMIN_PASSWORD.');
  }
}

async function main() {
  checkAuthConfig();
  await connectDb();
  await ensureIndexes();

  const initialConfig = await listConfig();
  let currentConfig = initialConfig;

  async function applyConfig(config: AppConfig): Promise<void> {
    const oldIds = new Set(currentConfig.services.map(service => service.id));
    const newIds = new Set(config.services.map(service => service.id));

    const addedServices = config.services.filter(service => !oldIds.has(service.id));
    await Promise.all(addedServices.map(service => rebuildStateFromDb(service)));
    for (const service of config.services) {
      (service.paused ? pauseService : resumeService)(service.id);
    }
    updateDispatcher(config.alerts, config.services);
    await updateScheduler(config.services);

    for (const id of oldIds) {
      if (!newIds.has(id)) {
        await closeOpenIncident(id);
        removeState(id);
        resumeService(id);
        resetCooldown(id);
        clearSslResult(id);
      }
    }

    updateApiServices(config.services);

    currentConfig = config;
  }

  await Promise.all(currentConfig.services.map(service => rebuildStateFromDb(service)));

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  updateApiServices(currentConfig.services);
  initDispatcher(currentConfig.alerts, currentConfig.services);
  for (const service of currentConfig.services) {
    (service.paused ? pauseService : resumeService)(service.id);
  }
  await initScheduler(currentConfig.services);

  setConfigApplier(applyConfig);
  const server = startServer(port);

  const retentionDays = Number.parseInt(process.env.DATA_RETENTION_DAYS ?? '30', 10);
  const cleanup = async () => {
    try {
      await deleteOldResults(retentionDays);
      logger.info('Cleanup job ran');
    } catch (err: unknown) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Cleanup job failed');
    }
  };
  // Run at startup too, so frequently restarted deployments still prune data.
  void cleanup();
  const cleanupTimer = setInterval(cleanup, 24 * 60 * 60 * 1000);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    try {
      clearInterval(cleanupTimer);
      await server.stop();
      await stopAll();
      await getAdapter().close();
    } catch (err: unknown) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Shutdown failed');
    }
    clearTimeout(force);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info('✅ LitePulse ready');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
