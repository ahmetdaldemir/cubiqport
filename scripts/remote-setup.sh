#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CubiqPort — Remote Server Setup
# Runs on: 45.67.203.202  as root
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/html"
LOG_DIR="/var/log/pm2"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " CubiqPort Server Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System dependencies ────────────────────────────────────────────────────
echo "[1/9] Updating apt and installing dependencies…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git build-essential redis-server postgresql-client

# ── 2. Node.js 20 ────────────────────────────────────────────────────────────
echo "[2/9] Installing Node.js 20…"
if ! node -e "process.exit(+process.versions.node.split('.')[0] >= 20 ? 0 : 1)" 2>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# ── 3. Redis ─────────────────────────────────────────────────────────────────
echo "[3/9] Ensuring Redis is running…"
systemctl enable redis-server
systemctl start redis-server
redis-cli ping

# ── 4. PM2 ───────────────────────────────────────────────────────────────────
echo "[4/9] Installing PM2…"
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
mkdir -p "$LOG_DIR"

# ── 5. PostgreSQL — create database ─────────────────────────────────────────
echo "[5/9] Creating cubiqport database (if not exists)…"
PGPASSWORD="YeniSifre123!" psql \
    -h 141.91.65.111 -p 5432 -U postgres \
    -c "CREATE DATABASE cubiqport;" 2>/dev/null || echo "  Database already exists — skipping."

# ── 6. npm install ────────────────────────────────────────────────────────────
echo "[6/9] Installing npm workspace dependencies…"
cd "$APP_DIR"
npm install --legacy-peer-deps 2>&1 | tail -5

# ── 7. Build ─────────────────────────────────────────────────────────────────
echo "[7/9] Building API and Web…"

# Build API (TypeScript → dist/)
npm run build --workspace=apps/api 2>&1 | tail -5

# Build Next.js (standalone output)
npm run build --workspace=apps/web 2>&1 | tail -10

# Copy Next.js standalone static files
WEB_STANDALONE="$APP_DIR/apps/web/.next/standalone"
cp -r "$APP_DIR/apps/web/.next/static"  "$WEB_STANDALONE/apps/web/.next/static"
cp -r "$APP_DIR/apps/web/public"        "$WEB_STANDALONE/apps/web/public" 2>/dev/null || true

# ── 8. DB migration ───────────────────────────────────────────────────────────
echo "[8/9] Running database migrations…"
cd "$APP_DIR"
node -e "
  import('./apps/api/dist/db/migrate.js').catch(e => { console.error(e); process.exit(1); });
"

# ── 9. nginx config ───────────────────────────────────────────────────────────
echo "[9/9] Configuring nginx on port 8083…"
cp "$APP_DIR/scripts/nginx-cubiqport.conf" /etc/nginx/sites-available/cubiqport
ln -sf /etc/nginx/sites-available/cubiqport /etc/nginx/sites-enabled/cubiqport

# Disable default site (avoids port 80 conflict)
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

# ── PM2 start ────────────────────────────────────────────────────────────────
echo "Starting PM2 processes…"
cd "$APP_DIR"
pm2 delete cubiqport-api 2>/dev/null || true
pm2 delete cubiqport-web 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

sleep 3
pm2 list

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✓  CubiqPort deployed successfully!"
echo "    Dashboard → http://45.67.203.202:8083"
echo "    API       → http://45.67.203.202:4000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
