#!/usr/bin/env node
/**
 * Run only migration 0006_domain_analysis_reports.sql (domain analysis tables).
 * Usage: node --env-file=/var/www/html/.env run-migration-0006.mjs
 * Or: cd /var/www/html && node --env-file=.env scripts/run-migration-0006.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = '0006_domain_analysis_reports.sql';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function run() {
  await client.connect();
  const { rows } = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [FILE]);
  if (rows.length > 0) {
    console.log(`${FILE} already applied`);
    return;
  }
  const migrationsDir = join(__dirname, '../apps/api/dist/apps/api/src/db/migrations');
  const sqlPath = join(migrationsDir, FILE);
  const sql = readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [FILE]);
  console.log(`Applied ${FILE}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
