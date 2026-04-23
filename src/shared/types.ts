export interface ServiceConfig {
  id: string;
  name: string;
  type: 'http' | 'tcp';
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
  alertChannels?: string[];
  /** Days before TLS cert expiry to send a warning. Omit to disable SSL checks. */
  sslExpiryWarningDays?: number;
  /** Scheduled maintenance windows — alerts are suppressed during these periods. */
  maintenanceWindows?: MaintenanceWindow[];
  /** Minutes to suppress repeat alerts after one fires (0 = no cooldown). */
  alertCooldownMinutes?: number;
}

export interface MaintenanceWindow {
  /** 0 = Sunday … 6 = Saturday. Omit to match every day. */
  weekdays?: number[];
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}

export interface AlertChannel {
  id: string;
  name: string;
  description?: string;
  type: 'email' | 'webhook' | 'telegram';
  to?: string[];
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  chatId?: string;
  botToken?: string;
}

export interface CheckResult {
  serviceId: string;
  status: 'up' | 'down';
  responseTime: number;
  checkedAt: Date;
  error?: string;
  httpStatus?: number;
}

export interface SslCheckResult {
  serviceId: string;
  hostname: string;
  expiresAt: Date;
  daysRemaining: number;
  checkedAt: Date;
  error?: string;
}

export interface Incident {
  serviceId: string;
  status: 'open' | 'resolved';
  openedAt: Date;
  resolvedAt?: Date;
  duration?: number;
  cause: string;
}

export interface ServiceState {
  serviceId: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  activeIncidentId: string | null;
  lastStatus: 'up' | 'down' | 'unknown';
}
