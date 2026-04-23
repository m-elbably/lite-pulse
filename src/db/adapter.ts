import type { CheckResult, Incident } from '../shared/types';
import type { ValidatedAlertChannel, ValidatedServiceConfig } from '../config/schemas';

export interface IncidentRow extends Incident {
  id: string;
}

export interface DbAdapter {
  connect(): Promise<void>;
  ensureSchema(): Promise<void>;

  insertCheckResult(result: CheckResult): Promise<void>;
  getRecentResults(serviceId: string, limit: number): Promise<CheckResult[]>;
  getUptime24h(serviceId: string): Promise<number>;
  deleteOldResults(retentionDays: number): Promise<void>;

  insertIncident(incident: Incident): Promise<string>;
  resolveIncident(id: string, resolvedAt: Date, duration: number): Promise<void>;
  getOpenIncident(serviceId: string): Promise<IncidentRow | null>;
  getRecentIncidents(limit: number, offset: number): Promise<{ total: number; incidents: IncidentRow[] }>;

  listServices(): Promise<ValidatedServiceConfig[]>;
  createService(service: ValidatedServiceConfig): Promise<void>;
  updateService(serviceId: string, service: ValidatedServiceConfig): Promise<void>;
  deleteService(serviceId: string): Promise<void>;
  listAlerts(): Promise<ValidatedAlertChannel[]>;
  createAlert(alert: ValidatedAlertChannel): Promise<void>;
  updateAlert(alertId: string, alert: ValidatedAlertChannel): Promise<void>;
  deleteAlert(alertId: string): Promise<void>;
}

let adapter: DbAdapter | null = null;

export function setAdapter(nextAdapter: DbAdapter): void {
  adapter = nextAdapter;
}

export function getAdapter(): DbAdapter {
  if (!adapter) throw new Error('DB adapter not initialised — call setAdapter() first');
  return adapter;
}


