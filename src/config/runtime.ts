import type { AppConfig } from './types';

export type ConfigApplier = (config: AppConfig) => Promise<void> | void;

let applyConfigHandler: ConfigApplier | null = null;

export function setConfigApplier(handler: ConfigApplier): void {
  applyConfigHandler = handler;
}

export async function applyConfig(config: AppConfig): Promise<AppConfig> {
  if (applyConfigHandler) {
    await applyConfigHandler(config);
  }

  return config;
}

