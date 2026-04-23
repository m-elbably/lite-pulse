import { apiFetch } from './useApi.ts';
import type { AdminConfig, AlertChannel, ServiceConfig } from '../types.ts';

export function useAdminApi() {
  return {
    listConfig: () => apiFetch<AdminConfig>('/api/admin/config'),
    listRuntimeServices: () => apiFetch<{ services: Array<{ id: string; paused: boolean }> }>('/api/services'),
    createService: (payload: ServiceConfig) =>
      apiFetch<AdminConfig>('/api/admin/services', { method: 'POST', body: JSON.stringify(payload) }),
    updateService: (id: string, payload: ServiceConfig) =>
      apiFetch<AdminConfig>(`/api/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteService: (id: string) => apiFetch<AdminConfig>(`/api/admin/services/${id}`, { method: 'DELETE' }),
    createAlert: (payload: AlertChannel) =>
      apiFetch<AdminConfig>('/api/admin/alerts', { method: 'POST', body: JSON.stringify(payload) }),
    updateAlert: (id: string, payload: AlertChannel) =>
      apiFetch<AdminConfig>(`/api/admin/alerts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteAlert: (id: string) => apiFetch<AdminConfig>(`/api/admin/alerts/${id}`, { method: 'DELETE' }),
    pauseService: (id: string) => apiFetch<{ id: string; paused: boolean }>(`/api/services/${id}/pause`, { method: 'POST' }),
    resumeService: (id: string) => apiFetch<{ id: string; paused: boolean }>(`/api/services/${id}/resume`, { method: 'POST' }),
  };
}


