import { setAdapter, getAdapter } from './adapter';
import { MongoAdapter } from './adapters/mongo';
import { SqliteAdapter } from './adapters/sqlite';
import { logger } from '../shared/logger';

export async function connectDb(): Promise<void> {
  const backend = (process.env.DB_ADAPTER ?? 'mongodb').toLowerCase();

  if (backend === 'sqlite') {
	setAdapter(new SqliteAdapter());
  } else {
	setAdapter(new MongoAdapter());
  }

  await getAdapter().connect();
  logger.info({ backend }, 'DB adapter ready');
}

export async function ensureIndexes(): Promise<void> {
  await getAdapter().ensureSchema();
}


