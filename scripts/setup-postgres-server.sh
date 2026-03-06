#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Sunucuda PostgreSQL kurulumu + dev_user / dev_pass ile veritabanı
# Çalıştırma: sunucuda root olarak çalıştırın veya:
#   ssh root@45.67.203.202 'bash -s' < scripts/setup-postgres-server.sh
# -----------------------------------------------------------------------------
set -e

DB_USER="${DB_USER:-dev_user}"
DB_PASS="${DB_PASS:-dev_pass}"
DB_NAME="${DB_NAME:-cubiqport}"

echo "PostgreSQL kuruluyor (apt)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib

echo "PostgreSQL servisi başlatılıyor…"
systemctl start postgresql || true
systemctl enable postgresql || true

echo "Kullanıcı ve veritabanı oluşturuluyor: $DB_USER / $DB_NAME"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
-- Kullanıcı yoksa oluştur
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;

-- Veritabanı yoksa oluştur
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Yetkiler (PostgreSQL 15+ public schema)
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

# Yerel şifre ile girişe izin ver (pg_hba)
PG_HBA="/etc/postgresql/$(ls /etc/postgresql 2>/dev/null | head -1)/main/pg_hba.conf"
if [ -f "$PG_HBA" ] && ! grep -q "dev_user\|$DB_USER" "$PG_HBA"; then
  echo "pg_hba.conf güncelleniyor (local password auth)…"
  sed -i.bak '/^local.*all.*postgres/s/peer/trust/' "$PG_HBA"
  echo "host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256" >> "$PG_HBA"
  echo "host    $DB_NAME    $DB_USER    ::1/128        scram-sha-256" >> "$PG_HBA"
  systemctl restart postgresql || true
fi

echo ""
echo "✓ PostgreSQL hazır."
echo "  Veritabanı: $DB_NAME"
echo "  Kullanıcı:  $DB_USER"
echo "  DATABASE_URL örneği: postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
echo "  (Şifrede özel karakter varsa URL-encode edin, örn. @ → %40)"
