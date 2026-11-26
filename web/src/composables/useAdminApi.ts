import { apiFetch } from './useApi.ts';
import type { AdminConfig, AlertChannel, DeliveryStatus, ServiceConfig } from '../types.ts';

export function useAdminApi() {
  return {
    deliveryStatuses: () => apiFetch<{ channels: Record<string, DeliveryStatus> }>('/api/admin/alerts/delivery'),
    testAlert: (id: string) => apiFetch(`/api/admin/alerts/${encodeURIComponent(id)}/test`, { method: 'POST' }),
    listConfig: () => apiFetch<AdminConfig>('/api/admin/config'),
    listRuntimeServices: () => apiFetch<{ services: Array<{ id: string; paused: boolean }> }>('/api/services'),
    createService: (payload: ServiceConfig) =>
      apiFetch<AdminConfig>('/api/admin/services', { method: 'POST', body: JSON.stringify(payload) }),
    updateService: (id: string, payload: ServiceConfig) =>
      apiFetch<AdminConfig>(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteService: (id: string) => apiFetch<AdminConfig>(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    createAlert: (payload: AlertChannel) =>
      apiFetch<AdminConfig>('/api/admin/alerts', { method: 'POST', body: JSON.stringify(payload) }),
    updateAlert: (id: string, payload: AlertChannel) =>
      apiFetch<AdminConfig>(`/api/admin/alerts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteAlert: (id: string) => apiFetch<AdminConfig>(`/api/admin/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    pauseService: (id: string) => apiFetch<{ id: string; paused: boolean }>(`/api/services/${encodeURIComponent(id)}/pause`, { method: 'POST' }),
    resumeService: (id: string) => apiFetch<{ id: string; paused: boolean }>(`/api/services/${encodeURIComponent(id)}/resume`, { method: 'POST' }),
  };
}


