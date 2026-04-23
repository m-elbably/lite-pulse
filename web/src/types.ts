export type ServiceStatus = 'up' | 'down' | 'unknown';
export type IncidentStatus = 'open' | 'resolved';
export type ServiceType = 'http' | 'tcp';
export type AlertType = 'email' | 'webhook' | 'telegram';

export interface StatusHistoryItem {
  status: 'up' | 'down';
  responseTime: number;
  checkedAt?: string;
}

export interface SslStatus {
  hostname: string;
  expiresAt: string;
  daysRemaining: number;
  checkedAt: string;
  error?: string;
}

export interface DashboardService {
  id: string;
  name: string;
  status: ServiceStatus;
  responseTime: number | null;
  lastCheckedAt: string | null;
  uptime24h: number;
  paused: boolean;
  activeIncident: { id: string } | null;
  history: StatusHistoryItem[];
  sslExpiryWarningDays: number | null;
  sslStatus: SslStatus | null;
}

export interface StatusResponse {
  generatedAt: string;
  summary: {
    total: number;
    up: number;
    down: number;
  };
  services: DashboardService[];
}

export interface IncidentItem {
  id: string;
  serviceId: string;
  serviceName?: string;
  status: IncidentStatus;
  openedAt: string;
  resolvedAt?: string;
  duration?: number;
  cause: string;
}

export interface IncidentsResponse {
  total: number;
  incidents: IncidentItem[];
}

export interface MaintenanceWindow {
  weekdays?: number[];
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}

export interface ServiceConfig {
  id: string;
  name: string;
  type: ServiceType;
  url?: string;
  host?: string;
  port?: number;
  interval: number;
  timeout: number;
  method?: string;
  headers?: Record<string, string>;
  expectedStatus?: number;
  failureThreshold: number;
  successThreshold: number;
  alertChannels: string[];
  maintenanceWindows: MaintenanceWindow[];
  alertCooldownMinutes: number;
  sslExpiryWarningDays?: number;
}

export interface AlertChannel {
  id: string;
  name: string;
  description?: string;
  type: AlertType;
  to?: string[];
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  chatId?: string;
  botToken?: string;
}

export interface AdminConfig {
  services: ServiceConfig[];
  alerts: AlertChannel[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

