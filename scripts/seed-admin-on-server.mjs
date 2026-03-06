#!/usr/bin/env node
/**
 * Sunucuda tek seferlik çalıştırın: ilk admin kullanıcıyı oluşturur.
 * Önce 0002 migration'ı uygulanmış olmalı (suspended, superadmin).
 *
 * Kullanım (sunucuda):
 *   cd /var/www/html && node --env-file=.env scripts/seed-admin-on-server.mjs
 *
 * Varsayılan: admin@cubiqport.io / Admin1234!
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL gerekli (.env veya --env-file=.env)');
  process.exit(1);
}

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@cubiqport.io';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
const SALT_ROUNDS = 12;

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // 1) 0002 migration'ı uygula (idempotent) — dist veya src
    const candidates = [
      join(__dirname, '../apps/api/dist/apps/api/src/db/migrations/0002_users_superadmin_suspended.sql'),
      join(__dirname, '../apps/api/src/db/migrations/0002_users_superadmin_suspended.sql'),
    ];
    let sql = null;
    for (const p of candidates) {
      try {
        sql = readFileSync(p, 'utf8');
        break;
      } catch (_) {}
    }
    if (sql) {
      await client.query(sql);
      console.log('0002_users_superadmin_suspended.sql uygulandı (veya zaten vardı).');
    } else {
      console.warn('0002 dosyası bulunamadı; suspended/superadmin zaten uygulanmış olabilir.');
    }

    // 2) Mevcut kullanıcı var mı?
    const { rows } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [EMAIL],
    );
    if (rows.length > 0) {
      console.log(`Kullanıcı zaten var: ${EMAIL}. Şifre güncellemek için önce silin veya DB'de güncelleyin.`);
      return;
    }

    const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
    await client.query(
      `INSERT INTO users (email, password, role, suspended, created_at, updated_at)
       VALUES ($1, $2, 'superadmin', false, NOW(), NOW())`,
      [EMAIL, hash],
    );
    console.log(`Admin oluşturuldu: ${EMAIL} (rol: superadmin)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
