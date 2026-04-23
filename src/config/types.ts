import type { ValidatedAlertChannel, ValidatedServiceConfig } from './schemas';

export interface AppConfig {
  services: ValidatedServiceConfig[];
  alerts: ValidatedAlertChannel[];
}
