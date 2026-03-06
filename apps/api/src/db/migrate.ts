import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const client = new Client({ connectionString: config.DATABASE_URL });
  await client.connect();

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) NOT NULL UNIQUE,
        applied_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    const migrationFiles = [
  '0001_initial_schema.sql',
  '0002_users_superadmin_suspended.sql',
  '0003_servers_password_auth.sql',
  '0004_domains_extra_columns.sql',
  '0005_billing_tables.sql',
];

    for (const file of migrationFiles) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1',
        [file],
      );
      if (rows.length > 0) {
        logger.info(`Migration already applied: ${file}`);
        continue;
      }

      const sql = readFileSync(join(__dirname, 'migrations', file), 'utf8');
      logger.info(`Applying migration: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info(`Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    logger.info('All migrations complete');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
