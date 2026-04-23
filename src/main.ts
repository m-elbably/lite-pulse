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
import { resumeService } from './monitoring/paused';
import { clearSslResult } from './monitoring/ssl-status';
import type { AppConfig } from './config/types';

async function main() {
  await connectDb();
  await ensureIndexes();

  const initialConfig = await listConfig();
  let currentConfig = initialConfig;

  async function applyConfig(config: AppConfig): Promise<void> {
    const oldIds = new Set(currentConfig.services.map(service => service.id));
    const newIds = new Set(config.services.map(service => service.id));

    for (const id of oldIds) {
      if (!newIds.has(id)) {
        removeState(id);
        resumeService(id);
        resetCooldown(id);
        clearSslResult(id);
      }
    }

    const addedServices = config.services.filter(service => !oldIds.has(service.id));
    await Promise.all(addedServices.map(service => rebuildStateFromDb(service)));

    updateScheduler(config.services);
    updateDispatcher(config.alerts, config.services);
    updateApiServices(config.services);

    currentConfig = config;
  }

  await Promise.all(currentConfig.services.map(service => rebuildStateFromDb(service)));

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  startServer(port);
  updateApiServices(currentConfig.services);
  initDispatcher(currentConfig.alerts, currentConfig.services);
  initScheduler(currentConfig.services);

  setConfigApplier(applyConfig);

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

