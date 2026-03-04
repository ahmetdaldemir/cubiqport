import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

export const db = drizzle(pool, { schema, logger: config.NODE_ENV === 'development' });

export async function connectDb(): Promise<void> {
  const client = await pool.connect();
  client.release();
  logger.info('PostgreSQL connected');
}

export async function disconnectDb(): Promise<void> {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}
