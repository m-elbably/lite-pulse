import { getAdapter } from './adapter';
import type { CheckResult, Incident } from '../shared/types';
import type { ValidatedAlertChannel, ValidatedServiceConfig } from '../config/schemas';

export const insertCheckResult = (r: CheckResult) => getAdapter().insertCheckResult(r);
export const getRecentResults = (serviceId: string, limit: number) => getAdapter().getRecentResults(serviceId, limit);
export const getUptime24h = (serviceId: string) => getAdapter().getUptime24h(serviceId);
export const deleteOldResults = (retentionDays: number) => getAdapter().deleteOldResults(retentionDays);

export const insertIncident = (i: Incident) => getAdapter().insertIncident(i);
export const resolveIncident = (id: string, at: Date, ms: number) => getAdapter().resolveIncident(id, at, ms);
export const getOpenIncident = (serviceId: string) => getAdapter().getOpenIncident(serviceId);
export const getRecentIncidents = (limit: number, offset: number) => getAdapter().getRecentIncidents(limit, offset);

export const listServices = () => getAdapter().listServices();
export const createServiceConfig = (service: ValidatedServiceConfig) => getAdapter().createService(service);
export const updateServiceConfig = (id: string, service: ValidatedServiceConfig) => getAdapter().updateService(id, service);
export const deleteServiceConfig = (id: string) => getAdapter().deleteService(id);
export const listAlerts = () => getAdapter().listAlerts();
export const createAlertConfig = (alert: ValidatedAlertChannel) => getAdapter().createAlert(alert);
export const updateAlertConfig = (id: string, alert: ValidatedAlertChannel) => getAdapter().updateAlert(id, alert);
export const deleteAlertConfig = (id: string) => getAdapter().deleteAlert(id);


