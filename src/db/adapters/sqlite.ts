import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import type { DbAdapter, IncidentRow } from '../adapter';
import type { CheckResult, Incident } from '../../shared/types';
import type { ValidatedAlertChannel, ValidatedServiceConfig } from '../../config/schemas';
import { logger } from '../../shared/logger';

interface CheckResultRow {
  serviceId: string;
  status: 'up' | 'down';
  responseTime: number;
  checkedAt: number;
  error: string | null;
  httpStatus: number | null;
}

interface UptimeRow { total: number; up: number | null; }

interface CountRow {
  n: number;
}

interface IncidentSqlRow {
  id: string;
  serviceId: string;
  status: Incident['status'];
  openedAt: number;
  resolvedAt: number | null;
  duration: number | null;
  cause: string;
}

interface ServiceConfigRow {
  id: string;
  name: string;
  type: ValidatedServiceConfig['type'];
  url: string | null;
  host: string | null;
  port: number | null;
  interval: number;
  timeout: number;
  method: string | null;
  headers: string | null;
  expectedStatus: number | null;
  failureThreshold: number;
  successThreshold: number;
  alertChannels: string;
  sslExpiryWarningDays: number | null;
  maintenanceWindows: string;
  alertCooldownMinutes: number;
  paused: number;
}

interface AlertChannelRow {
  id: string;
  name: string;
  description: string | null;
  type: ValidatedAlertChannel['type'];
  toJson: string | null;
  url: string | null;
  method: string | null;
  headers: string | null;
  chatId: string | null;
  botToken: string | null;
}

export class SqliteAdapter implements DbAdapter {
  private db!: Database;
  private readonly path: string;

  constructor(dbPath?: string) {
	this.path = dbPath ?? process.env.SQLITE_PATH ?? './uptime.db';
  }

  async connect(): Promise<void> {
	this.db = new Database(this.path, { create: true });
	this.db.exec('PRAGMA journal_mode = WAL;');
	this.db.exec('PRAGMA foreign_keys = ON;');
	logger.info({ path: this.path }, 'Connected to SQLite');
  }

  async ensureSchema(): Promise<void> {
	this.db.exec(`
	  CREATE TABLE IF NOT EXISTS check_results (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		serviceId   TEXT    NOT NULL,
		status      TEXT    NOT NULL,
		responseTime INTEGER NOT NULL,
		checkedAt   INTEGER NOT NULL,
		error       TEXT,
		httpStatus  INTEGER
	  );
	  CREATE INDEX IF NOT EXISTS idx_cr_service_time
		ON check_results(serviceId, checkedAt DESC);

	  CREATE TABLE IF NOT EXISTS incidents (
		id          TEXT    PRIMARY KEY,
		serviceId   TEXT    NOT NULL,
		status      TEXT    NOT NULL,
		openedAt    INTEGER NOT NULL,
		resolvedAt  INTEGER,
		duration    INTEGER,
		cause       TEXT    NOT NULL
	  );
	  CREATE INDEX IF NOT EXISTS idx_inc_service_status
		ON incidents(serviceId, status);
	  CREATE INDEX IF NOT EXISTS idx_inc_opened
		ON incidents(openedAt DESC);

	  CREATE TABLE IF NOT EXISTS services (
		id                   TEXT PRIMARY KEY,
		name                 TEXT NOT NULL,
		type                 TEXT NOT NULL,
		url                  TEXT,
		host                 TEXT,
		port                 INTEGER,
		interval             INTEGER NOT NULL,
		timeout              INTEGER NOT NULL,
		method               TEXT,
		headers              TEXT,
		expectedStatus       INTEGER,
		failureThreshold     INTEGER NOT NULL,
		successThreshold     INTEGER NOT NULL,
		alertChannels        TEXT NOT NULL,
		sslExpiryWarningDays INTEGER,
		maintenanceWindows   TEXT NOT NULL,
		alertCooldownMinutes INTEGER NOT NULL DEFAULT 0,
        paused INTEGER NOT NULL DEFAULT 0
	  );
	  CREATE UNIQUE INDEX IF NOT EXISTS idx_services_name_unique
		ON services(lower(trim(name)));

	  CREATE TABLE IF NOT EXISTS alerts (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		description TEXT,
		type        TEXT NOT NULL,
		toJson      TEXT,
		url         TEXT,
		method      TEXT,
		headers     TEXT,
		chatId      TEXT,
		botToken    TEXT
	  );
	  CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_name_unique
		ON alerts(lower(trim(name)));
	`);
    const columns = this.db.prepare('PRAGMA table_info(services)').all() as Array<{ name: string }>;
    if (!columns.some(column => column.name === 'paused')) {
      this.db.exec('ALTER TABLE services ADD COLUMN paused INTEGER NOT NULL DEFAULT 0');
    }
	logger.info('SQLite schema ensured');
  }

  async insertCheckResult(result: CheckResult): Promise<void> {
	this.db.prepare(`
		INSERT INTO check_results (serviceId, status, responseTime, checkedAt, error, httpStatus)
		VALUES (?, ?, ?, ?, ?, ?)
	`).run(
		result.serviceId,
		result.status,
		result.responseTime,
		result.checkedAt.getTime(),
		result.error ?? null,
		result.httpStatus ?? null,
	);
  }

  async getRecentResults(serviceId: string, limit: number): Promise<CheckResult[]> {
	const rows = this.db.prepare(`
	  SELECT serviceId, status, responseTime, checkedAt, error, httpStatus
	  FROM check_results WHERE serviceId = ?
	  ORDER BY checkedAt DESC LIMIT ?
	`).all(serviceId, limit) as CheckResultRow[];

	return rows.map(row => ({
	  serviceId: row.serviceId,
	  status: row.status,
	  responseTime: row.responseTime,
	  checkedAt: new Date(row.checkedAt),
	  error: row.error ?? undefined,
	  httpStatus: row.httpStatus ?? undefined,
	}));
  }

  async getUptime24h(serviceId: string): Promise<number | null> {
	const since = Date.now() - 24 * 60 * 60 * 1000;
    const row = this.db.prepare(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up
      FROM check_results WHERE serviceId = ? AND checkedAt >= ?
    `).get(serviceId, since) as UptimeRow;
    return row.total === 0 ? null : Math.round(((row.up ?? 0) / row.total) * 10000) / 100;
  }

  async deleteOldResults(retentionDays: number): Promise<void> {
	const cutoff = Date.now() - retentionDays * 86400 * 1000;
	this.db.prepare('DELETE FROM check_results WHERE checkedAt < ?').run(cutoff);
  }

  async insertIncident(incident: Incident): Promise<string> {
	const id = randomUUID();
	this.db.prepare(`
	  INSERT INTO incidents (id, serviceId, status, openedAt, resolvedAt, duration, cause)
	  VALUES (?, ?, ?, ?, ?, ?, ?)
	`).run(
	  id,
	  incident.serviceId,
	  incident.status,
	  incident.openedAt.getTime(),
	  incident.resolvedAt?.getTime() ?? null,
	  incident.duration ?? null,
	  incident.cause,
	);
	return id;
  }

  async resolveIncident(id: string, resolvedAt: Date, duration: number): Promise<void> {
	this.db.prepare(`
	  UPDATE incidents SET status = 'resolved', resolvedAt = ?, duration = ? WHERE id = ?
	`).run(resolvedAt.getTime(), duration, id);
  }

  async getOpenIncident(serviceId: string): Promise<IncidentRow | null> {
	const row = this.db.prepare(`
	  SELECT id, serviceId, status, openedAt, resolvedAt, duration, cause
	  FROM incidents WHERE serviceId = ? AND status = 'open' LIMIT 1
	`).get(serviceId) as IncidentSqlRow | null;

	return row ? this.#mapIncident(row) : null;
  }

  async getRecentIncidents(limit: number, offset: number): Promise<{ total: number; incidents: IncidentRow[] }> {
	const total = (this.db.prepare('SELECT COUNT(*) as n FROM incidents').get() as CountRow).n;
	const rows = this.db.prepare(`
	  SELECT id, serviceId, status, openedAt, resolvedAt, duration, cause
	  FROM incidents ORDER BY openedAt DESC LIMIT ? OFFSET ?
	`).all(limit, offset) as IncidentSqlRow[];

	return {
	  total,
	  incidents: rows.map(row => this.#mapIncident(row)),
	};
  }

  #mapIncident(row: IncidentSqlRow): IncidentRow {
	return {
	  id: row.id,
	  serviceId: row.serviceId,
	  status: row.status,
	  openedAt: new Date(row.openedAt),
	  resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
	  duration: row.duration ?? undefined,
	  cause: row.cause,
	};
  }

  async listServices(): Promise<ValidatedServiceConfig[]> {
	const rows = this.db.prepare(`
	  SELECT id, name, type, url, host, port, interval, timeout, method, headers,
			 expectedStatus, failureThreshold, successThreshold, alertChannels,
			 sslExpiryWarningDays, maintenanceWindows, alertCooldownMinutes, paused
	  FROM services
	  ORDER BY name COLLATE NOCASE, id
	`).all() as ServiceConfigRow[];

	return rows.map(row => this.#mapService(row));
  }

  async createService(service: ValidatedServiceConfig): Promise<void> {
	this.db.prepare(`
	  INSERT INTO services (
		id, name, type, url, host, port, interval, timeout, method, headers,
		expectedStatus, failureThreshold, successThreshold, alertChannels,
		sslExpiryWarningDays, maintenanceWindows, alertCooldownMinutes
	  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
	  service.id,
	  service.name,
	  service.type,
	  service.url ?? null,
	  service.host ?? null,
	  service.port ?? null,
	  service.interval,
	  service.timeout,
	  service.method ?? null,
	  service.headers ? JSON.stringify(service.headers) : null,
	  service.expectedStatus ?? null,
	  service.failureThreshold,
	  service.successThreshold,
	  JSON.stringify(service.alertChannels ?? []),
	  service.sslExpiryWarningDays ?? null,
	  JSON.stringify(service.maintenanceWindows ?? []),
	  service.alertCooldownMinutes ?? 0,
	);
  }

  async updateService(serviceId: string, service: ValidatedServiceConfig): Promise<void> {
	this.db.prepare(`
	  UPDATE services
	  SET name = ?, type = ?, url = ?, host = ?, port = ?, interval = ?, timeout = ?,
		  method = ?, headers = ?, expectedStatus = ?, failureThreshold = ?,
		  successThreshold = ?, alertChannels = ?, sslExpiryWarningDays = ?,
		  maintenanceWindows = ?, alertCooldownMinutes = ?
	  WHERE id = ?
	`).run(
	  service.name,
	  service.type,
	  service.url ?? null,
	  service.host ?? null,
	  service.port ?? null,
	  service.interval,
	  service.timeout,
	  service.method ?? null,
	  service.headers ? JSON.stringify(service.headers) : null,
	  service.expectedStatus ?? null,
	  service.failureThreshold,
	  service.successThreshold,
	  JSON.stringify(service.alertChannels ?? []),
	  service.sslExpiryWarningDays ?? null,
	  JSON.stringify(service.maintenanceWindows ?? []),
	  service.alertCooldownMinutes ?? 0,
	  serviceId,
	);
  }

  async setServicePaused(serviceId: string, paused: boolean): Promise<void> {
    this.db.prepare('UPDATE services SET paused = ? WHERE id = ?').run(Number(paused), serviceId);
  }

  async deleteService(serviceId: string): Promise<void> {
	this.db.prepare('DELETE FROM services WHERE id = ?').run(serviceId);
  }

  async listAlerts(): Promise<ValidatedAlertChannel[]> {
	const rows = this.db.prepare(`
	  SELECT id, name, description, type, toJson, url, method, headers, chatId, botToken
	  FROM alerts
	  ORDER BY name COLLATE NOCASE, id
	`).all() as AlertChannelRow[];

	return rows.map(row => this.#mapAlert(row));
  }

  async createAlert(alert: ValidatedAlertChannel): Promise<void> {
	this.db.prepare(`
	  INSERT INTO alerts (id, name, description, type, toJson, url, method, headers, chatId, botToken)
	  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
	  alert.id,
	  alert.name,
	  alert.description ?? null,
	  alert.type,
	  alert.to ? JSON.stringify(alert.to) : null,
	  alert.url ?? null,
	  alert.method ?? null,
	  alert.headers ? JSON.stringify(alert.headers) : null,
	  alert.chatId ?? null,
	  alert.botToken ?? null,
	);
  }

  async updateAlert(alertId: string, alert: ValidatedAlertChannel): Promise<void> {
	this.db.prepare(`
	  UPDATE alerts
	  SET name = ?, description = ?, type = ?, toJson = ?, url = ?, method = ?,
		  headers = ?, chatId = ?, botToken = ?
	  WHERE id = ?
	`).run(
	  alert.name,
	  alert.description ?? null,
	  alert.type,
	  alert.to ? JSON.stringify(alert.to) : null,
	  alert.url ?? null,
	  alert.method ?? null,
	  alert.headers ? JSON.stringify(alert.headers) : null,
	  alert.chatId ?? null,
	  alert.botToken ?? null,
	  alertId,
	);
  }

  async deleteAlert(alertId: string): Promise<void> {
	this.db.prepare('DELETE FROM alerts WHERE id = ?').run(alertId);
  }

  #mapService(row: ServiceConfigRow): ValidatedServiceConfig {
	return {
	  id: row.id,
	  name: row.name,
	  type: row.type,
	  url: row.url ?? undefined,
	  host: row.host ?? undefined,
	  port: row.port ?? undefined,
	  interval: row.interval,
	  timeout: row.timeout,
	  method: row.method ?? 'GET',
	  headers: row.headers ? JSON.parse(row.headers) as Record<string, string> : undefined,
	  expectedStatus: row.expectedStatus ?? 200,
	  failureThreshold: row.failureThreshold,
	  successThreshold: row.successThreshold,
	  alertChannels: JSON.parse(row.alertChannels) as string[],
	  sslExpiryWarningDays: row.sslExpiryWarningDays ?? undefined,
	  maintenanceWindows: JSON.parse(row.maintenanceWindows) as ValidatedServiceConfig['maintenanceWindows'],
	  alertCooldownMinutes: row.alertCooldownMinutes,
      paused: !!row.paused,
	};
  }

  #mapAlert(row: AlertChannelRow): ValidatedAlertChannel {
	return {
	  id: row.id,
	  name: row.name,
	  description: row.description ?? undefined,
	  type: row.type,
	  to: row.toJson ? JSON.parse(row.toJson) as string[] : undefined,
	  url: row.url ?? undefined,
	  method: row.method ?? 'POST',
	  headers: row.headers ? JSON.parse(row.headers) as Record<string, string> : undefined,
	  chatId: row.chatId ?? undefined,
	  botToken: row.botToken ?? undefined,
	};
  }
}


