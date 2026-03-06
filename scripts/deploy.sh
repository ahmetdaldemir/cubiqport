#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CubiqPort — Deploy Script (run locally on macOS / Linux)
# Usage: bash scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVER_IP="144.91.65.111"
SERVER_USER="root"
SERVER_PASS='8H6g@yQ4ZtKST^^B'
SERVER_PATH="/var/www/port8083/html"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
fatal()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ── 0. Check / install sshpass ────────────────────────────────────────────────
if ! command -v sshpass &>/dev/null; then
    warn "sshpass not found — installing via Homebrew…"
    if command -v brew &>/dev/null; then
        brew install hudochenkov/sshpass/sshpass 2>/dev/null || \
        brew install sshpass 2>/dev/null || \
        fatal "Could not install sshpass. Install manually: brew install hudochenkov/sshpass/sshpass"
    else
        fatal "Homebrew not found. Install sshpass manually."
    fi
fi

SSH_CMD="sshpass -p '$SERVER_PASS' ssh $SSH_OPTS $SERVER_USER@$SERVER_IP"
RSYNC_CMD="sshpass -p '$SERVER_PASS' rsync -az --progress $SSH_OPTS"

info "Target: $SERVER_USER@$SERVER_IP:$SERVER_PATH"

# ── 1. Generate production secrets ────────────────────────────────────────────
info "Generating production secrets…"

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
AGENT_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")

# URL-encode the PostgreSQL password  (! → %21)
PG_PASS_ENCODED="YeniSifre123%21"

# ── 2. Write .env.production ──────────────────────────────────────────────────
info "Writing .env.production…"
cat > .env.production <<EOF
NODE_ENV=production

# API
API_PORT=4000
API_HOST=0.0.0.0

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:${PG_PASS_ENCODED}@141.91.65.111:5432/cubiqport

# Redis (local)
REDIS_URL=redis://127.0.0.1:6379

# Auth
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Encryption (AES-256-GCM — 32-byte hex)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Cloudflare (optional — set if you want automatic DNS)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=

# Agent
AGENT_PORT=9000
AGENT_SECRET=${AGENT_SECRET}

# Next.js internal API rewrite (server → API on same host)
API_INTERNAL_URL=http://127.0.0.1:4000

# Public URL for client-side (relative URLs used, so this is informational)
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:8083
EOF

info "Secrets written to .env.production"

# ── 3. Prepare remote directory ────────────────────────────────────────────────
info "Creating remote directory $SERVER_PATH …"
eval "$SSH_CMD" "mkdir -p $SERVER_PATH"

# ── 4. rsync source files to server ──────────────────────────────────────────
info "Uploading project files…"
eval "$RSYNC_CMD" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='*.log' \
    --delete \
    ./ "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"

# ── 5. Upload .env as .env on server ─────────────────────────────────────────
info "Uploading .env …"
eval "$RSYNC_CMD" .env.production "$SERVER_USER@$SERVER_IP:$SERVER_PATH/.env"

# ── 6. Upload remote setup script ────────────────────────────────────────────
info "Uploading setup script…"
eval "$RSYNC_CMD" scripts/remote-setup.sh "$SERVER_USER@$SERVER_IP:$SERVER_PATH/scripts/"

# ── 7. Make scripts executable on server ─────────────────────────────────────
eval "$SSH_CMD" "chmod +x $SERVER_PATH/scripts/remote-setup.sh"

# ── 8. Run remote setup ───────────────────────────────────────────────────────
info "Running remote setup (this may take 3-5 minutes)…"
eval "$SSH_CMD" "bash $SERVER_PATH/scripts/remote-setup.sh"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} ✓  Deployment complete!${NC}"
echo -e "    Dashboard : http://${SERVER_IP}:8083"
echo -e "    API       : http://${SERVER_IP}:4000"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
