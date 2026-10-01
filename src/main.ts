import './shared/env';
import { connectDb, ensureIndexes } from './db/client';
import { setConfigApplier } from './config/runtime';
import { listConfig } from './config/store';
import { rebuildStateFromDb } from './monitoring/engine';
import { removeState } from './monitoring/state';
import { initScheduler, updateScheduler } from './monitoring/scheduler';
import { initDispatcher, updateDispatcher } from './alerts/dispatcher';
import { startServer, updateApiServices } from './http/server';
import { deleteOldResults } from './db/repos';
import { resetCooldown } from './alerts/cooldown';
import { logger } from './shared/logger';
import { pauseService, resumeService } from './monitoring/paused';
import { getAdminAuthConfig, getStatusAuthConfig } from './http/auth';
import { clearSslResult } from './monitoring/ssl-status';
import type { AppConfig } from './config/types';

async function main() {
  getAdminAuthConfig();
  getStatusAuthConfig();
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
  startServer(port);

  const retentionDays = Number.parseInt(process.env.DATA_RETENTION_DAYS ?? '30', 10);
  setInterval(async () => {
    try {
      await deleteOldResults(retentionDays);
      logger.info('Cleanup job ran');
    } catch (err: unknown) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Cleanup job failed');
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('✅ LitePulse ready');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

