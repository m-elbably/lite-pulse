import { MongoClient, Db, ObjectId, type Filter } from 'mongodb';
import { randomUUID } from 'crypto';
import type { DbAdapter, IncidentRow } from '../adapter';
import type { CheckResult, Incident } from '../../shared/types';
import type { ValidatedAlertChannel, ValidatedServiceConfig } from '../../config/schemas';
import { logger } from '../../shared/logger';

interface StoredCheckResultDocument extends CheckResult {
	_id: string;
}

interface StoredServiceDocument extends Omit<ValidatedServiceConfig, 'id'> {
	_id: string;
  normalizedName: string;
}

interface StoredAlertDocument extends Omit<ValidatedAlertChannel, 'id'> {
	_id: string;
  normalizedName: string;
}

interface StoredIncidentDocument extends Incident {
	_id: string;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function toPublicId(value: unknown, fallback?: unknown): string {
	if (typeof fallback === 'string' && fallback.length > 0) return fallback;
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
	  return value.toString();
	}
	return String(value);
}

function maybeObjectId(id: string): ObjectId | null {
	return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function legacyIdFilter<T>(id: string): Filter<T> {
	const legacyObjectId = maybeObjectId(id);
	return (legacyObjectId
	  ? { $or: [{ _id: id }, { _id: legacyObjectId }, { id }] }
	  : { $or: [{ _id: id }, { id }] }) as unknown as Filter<T>;
}

export class MongoAdapter implements DbAdapter {
  private client!: MongoClient;
  private db!: Db;
  private readonly uri: string;

  constructor(uri?: string) {
	this.uri = uri ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lite-pulse';
  }

  async connect(): Promise<void> {
	this.client = new MongoClient(this.uri);
	await this.client.connect();
	this.db = this.client.db();
	logger.info('Connected to MongoDB');
  }

  async ensureSchema(): Promise<void> {
	const useCapped = process.env.MONGO_USE_CAPPED === 'true';
	const cappedSizeMb = parseInt(process.env.MONGO_CAPPED_SIZE_MB ?? '256');

	const existingCollections = await this.db.listCollections({ name: 'check_results' }).toArray();
	const collectionExists = existingCollections.length > 0;

	if (useCapped) {
	  if (!collectionExists) {
		await this.db.createCollection('check_results', {
		  capped: true,
		  size: cappedSizeMb * 1024 * 1024,
		});
		logger.info({ sizeMb: cappedSizeMb }, 'Created capped check_results collection');
	  }
	  await this.db.collection('check_results').createIndex({ serviceId: 1, checkedAt: -1 });
	} else {
	  const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS ?? '30');
	  await this.db.collection('check_results').createIndexes([
		{ key: { serviceId: 1, checkedAt: -1 } },
		{ key: { checkedAt: 1 }, expireAfterSeconds: retentionDays * 86400 },
	  ]);
	}

	await this.db.collection('incidents').createIndexes([
	  { key: { serviceId: 1, status: 1 } },
	  { key: { openedAt: -1 } },
	]);

	await this.db.collection<StoredServiceDocument>('services').createIndexes([
	  { key: { normalizedName: 1 }, unique: true },
	  { key: { name: 1 } },
	]);

	await this.db.collection<StoredAlertDocument>('alerts').createIndexes([
	  { key: { normalizedName: 1 }, unique: true },
	  { key: { name: 1 } },
	]);

	logger.info('MongoDB schema ensured');
  }

  async insertCheckResult(result: CheckResult): Promise<void> {
	await this.db.collection<StoredCheckResultDocument>('check_results').insertOne({
		_id: randomUUID(),
		...result,
	});
  }

  async getRecentResults(serviceId: string, limit: number): Promise<CheckResult[]> {
	const docs = await this.db
	  .collection('check_results')
	  .find({ serviceId })
	  .sort({ checkedAt: -1 })
	  .limit(limit)
	  .toArray();
	return docs.map(d => ({
	  serviceId: d.serviceId,
	  status: d.status,
	  responseTime: d.responseTime,
	  checkedAt: d.checkedAt,
	  error: d.error,
	  httpStatus: d.httpStatus,
	}));
  }

  async getUptime24h(serviceId: string): Promise<number | null> {
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [counts] = await this.db.collection('check_results').aggregate<{ total: number; up: number }>([
      { $match: { serviceId, checkedAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: 1 }, up: { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } } } },
    ]).toArray();
    return counts ? Math.round((counts.up / counts.total) * 10000) / 100 : null;
  }

  async deleteOldResults(retentionDays: number): Promise<void> {
	if (process.env.MONGO_USE_CAPPED === 'true') return;
	const cutoff = new Date(Date.now() - retentionDays * 86400 * 1000);
	await this.db.collection('check_results').deleteMany({ checkedAt: { $lt: cutoff } });
  }

  async insertIncident(incident: Incident): Promise<string> {
	const id = crypto.randomUUID();
	await this.db.collection<StoredIncidentDocument>('incidents').insertOne({ _id: id, ...incident });
	return id;
  }

  async resolveIncident(id: string, resolvedAt: Date, duration: number): Promise<void> {
	await this.db.collection<StoredIncidentDocument>('incidents').updateOne(
	  legacyIdFilter(id),
	  { $set: { status: 'resolved', resolvedAt, duration } },
	);
  }

  async getOpenIncident(serviceId: string): Promise<IncidentRow | null> {
	const doc = await this.db.collection<StoredIncidentDocument>('incidents').findOne({ serviceId, status: 'open' });
	if (!doc) return null;
	return {
	  id: toPublicId(doc._id, (doc as { id?: unknown }).id),
	  serviceId: doc.serviceId,
	  status: doc.status,
	  openedAt: doc.openedAt,
	  resolvedAt: doc.resolvedAt,
	  duration: doc.duration,
	  cause: doc.cause,
	};
  }

  async getRecentIncidents(limit: number, offset: number): Promise<{ total: number; incidents: IncidentRow[] }> {
	const col = this.db.collection<StoredIncidentDocument>('incidents');
	const total = await col.countDocuments();
	const docs = await col.find().sort({ openedAt: -1 }).skip(offset).limit(limit).toArray();
	return {
	  total,
	  incidents: docs.map(d => ({
		id: toPublicId(d._id, (d as { id?: unknown }).id),
		serviceId: d.serviceId,
		status: d.status,
		openedAt: d.openedAt,
		resolvedAt: d.resolvedAt,
		duration: d.duration,
		cause: d.cause,
	  })),
	};
  }

  async listServices(): Promise<ValidatedServiceConfig[]> {
	const docs = await this.db
	  .collection<StoredServiceDocument>('services')
	  .find()
	  .sort({ name: 1, _id: 1 })
	  .toArray();

	return docs.map(({ _id, normalizedName: _normalizedName, ...service }) => ({
	  ...service,
      paused: service.paused ?? false,
	  id: toPublicId(_id, (service as { id?: unknown }).id),
	}));
  }

  async createService(service: ValidatedServiceConfig): Promise<void> {
	await this.db.collection<StoredServiceDocument>('services').insertOne({
	  _id: service.id,
	  name: service.name,
	  type: service.type,
	  url: service.url,
	  host: service.host,
	  port: service.port,
	  interval: service.interval,
	  timeout: service.timeout,
	  method: service.method,
	  headers: service.headers,
	  expectedStatus: service.expectedStatus,
	  failureThreshold: service.failureThreshold,
	  successThreshold: service.successThreshold,
	  alertChannels: service.alertChannels,
	  sslExpiryWarningDays: service.sslExpiryWarningDays,
	  maintenanceWindows: service.maintenanceWindows,
	  alertCooldownMinutes: service.alertCooldownMinutes,
	  normalizedName: normalizeName(service.name),
	});
  }

  async updateService(serviceId: string, service: ValidatedServiceConfig): Promise<void> {
	await this.db.collection<StoredServiceDocument>('services').updateOne(
	  legacyIdFilter(serviceId),
	  {
		$set: {
		  name: service.name,
		  type: service.type,
		  url: service.url,
		  host: service.host,
		  port: service.port,
		  interval: service.interval,
		  timeout: service.timeout,
		  method: service.method,
		  headers: service.headers,
		  expectedStatus: service.expectedStatus,
		  failureThreshold: service.failureThreshold,
		  successThreshold: service.successThreshold,
		  alertChannels: service.alertChannels,
		  sslExpiryWarningDays: service.sslExpiryWarningDays,
		  maintenanceWindows: service.maintenanceWindows,
		  alertCooldownMinutes: service.alertCooldownMinutes,
		  normalizedName: normalizeName(service.name),
		},
	  },
	);
  }

  async setServicePaused(serviceId: string, paused: boolean): Promise<void> {
    await this.db.collection<StoredServiceDocument>('services').updateOne(legacyIdFilter(serviceId), { $set: { paused } });
  }

  async deleteService(serviceId: string): Promise<void> {
	await this.db.collection<StoredServiceDocument>('services').deleteOne(legacyIdFilter(serviceId));
  }

  async listAlerts(): Promise<ValidatedAlertChannel[]> {
	const docs = await this.db
	  .collection<StoredAlertDocument>('alerts')
	  .find()
	  .sort({ name: 1, _id: 1 })
	  .toArray();

	return docs.map(({ _id, normalizedName: _normalizedName, ...alert }) => ({
	  ...alert,
	  id: toPublicId(_id, (alert as { id?: unknown }).id),
	}));
  }

  async createAlert(alert: ValidatedAlertChannel): Promise<void> {
	await this.db.collection<StoredAlertDocument>('alerts').insertOne({
	  _id: alert.id,
	  name: alert.name,
	  description: alert.description,
	  type: alert.type,
	  to: alert.to,
	  url: alert.url,
	  method: alert.method,
	  headers: alert.headers,
	  chatId: alert.chatId,
	  botToken: alert.botToken,
	  normalizedName: normalizeName(alert.name),
	});
  }

  async updateAlert(alertId: string, alert: ValidatedAlertChannel): Promise<void> {
	await this.db.collection<StoredAlertDocument>('alerts').updateOne(
	  legacyIdFilter(alertId),
	  {
		$set: {
		  name: alert.name,
		  description: alert.description,
		  type: alert.type,
		  to: alert.to,
		  url: alert.url,
		  method: alert.method,
		  headers: alert.headers,
		  chatId: alert.chatId,
		  botToken: alert.botToken,
		  normalizedName: normalizeName(alert.name),
		},
	  },
	);
  }

  async deleteAlert(alertId: string): Promise<void> {
	await this.db.collection<StoredAlertDocument>('alerts').deleteOne(legacyIdFilter(alertId));
  }
}


