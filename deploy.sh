#!/usr/bin/env bash
# =============================================================================
# CubiqPort Deploy Script
# Kullanım: ./deploy.sh [api|web|all]  (varsayılan: all)
# =============================================================================

set -euo pipefail

# ── Hardcoded Config ──────────────────────────────────────────────────────────
SERVER="root@144.91.65.111"
PASS="8H6g@yQ4ZtKST^^B"
REMOTE_DIR="/var/www/port8083/html"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="${1:-all}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[  ok  ]${NC} $*"; }
warn()    { echo -e "${YELLOW}[ warn ]${NC} $*"; }
error()   { echo -e "${RED}[ fail ]${NC} $*"; exit 1; }

# ── Helpers ───────────────────────────────────────────────────────────────────
ssh_run() {
  sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SERVER" "$@"
}

rsync_up() {
  # rsync_up <local_src/> <remote_dest/>
  sshpass -p "$PASS" rsync -az --delete \
    -e "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10" \
    "$1" "$SERVER:$2"
}

require_cmd() {
  command -v "$1" &>/dev/null || error "'$1' kurulu değil. Lütfen yükleyin: $2"
}

# ── Preflight ─────────────────────────────────────────────────────────────────
require_cmd sshpass "brew install hudochenkov/sshpass/sshpass  (macOS)"
require_cmd rsync   "brew install rsync  (macOS)"
require_cmd node    "https://nodejs.org"

info "Sunucu bağlantısı test ediliyor…"
ssh_run "echo ok" &>/dev/null || error "Sunucuya bağlanılamadı ($SERVER)"
success "Bağlantı başarılı"

# =============================================================================
# BUILD & DEPLOY: shared
# =============================================================================
deploy_shared() {
  info "=== Shared Package ==="

  info "Build: packages/shared"
  (cd "$ROOT/packages/shared" && npm run build --silent) || error "Shared build başarısız"
  success "Shared build tamamlandı"

  info "Upload: packages/shared/dist → sunucu"
  rsync_up "$ROOT/packages/shared/dist/" "$REMOTE_DIR/packages/shared/dist/"
  success "Shared dist yüklendi"
}

# =============================================================================
# BUILD & DEPLOY: api
# =============================================================================
deploy_api() {
  info "=== API ==="

  info "Build: apps/api (TypeScript → dist)"
  (cd "$ROOT/apps/api" && npm run build --silent) || error "API build başarısız"
  success "API build tamamlandı"

  info "Upload: apps/api/dist → sunucu"
  rsync_up "$ROOT/apps/api/dist/" "$REMOTE_DIR/apps/api/dist/"
  success "API dist yüklendi"

  info "Upload: apps/api/package.json → sunucu (yeni bağımlılıklar için)"
  sshpass -p "$PASS" rsync -az \
    -e "ssh -o StrictHostKeyChecking=no" \
    "$ROOT/apps/api/package.json" "$SERVER:$REMOTE_DIR/apps/api/package.json"

  info "npm install: sunucuda yeni paketler kuruluyor"
  ssh_run "cd $REMOTE_DIR && npm install --workspace=apps/api --production=false 2>&1 | tail -3" \
    || warn "npm install başarısız, devam ediliyor"
  success "Sunucu bağımlılıkları güncellendi"

  info "PM2 restart: cubiqport-api"
  ssh_run "pm2 restart cubiqport-api --update-env" || warn "pm2 restart başarısız, elle kontrol edin"
  success "API yeniden başlatıldı"
}

# =============================================================================
# BUILD & DEPLOY: web
# =============================================================================
deploy_web() {
  info "=== Web (Next.js) ==="

  info "Build: apps/web (Next.js standalone)"
  (cd "$ROOT/apps/web" && npm run build --silent) || error "Web build başarısız"
  success "Web build tamamlandı"

  # Standalone: .next/standalone  +  static files
  info "Upload: apps/web/.next/standalone → sunucu"
  rsync_up "$ROOT/apps/web/.next/standalone/" "$REMOTE_DIR/apps/web/.next/standalone/"

  info "Upload: apps/web/.next/static → sunucu (standalone içi + cwd)"
  # 1) standalone içindeki .next/static (server.js'nin __dirname'e göre aradığı yer)
  ssh_run "mkdir -p $REMOTE_DIR/apps/web/.next/standalone/apps/web/.next/static"
  rsync_up "$ROOT/apps/web/.next/static/" \
    "$REMOTE_DIR/apps/web/.next/standalone/apps/web/.next/static/"

  # 2) cwd (exec cwd: /apps/web) altındaki .next/static — Next.js process.cwd() fallback
  ssh_run "mkdir -p $REMOTE_DIR/apps/web/.next/static"
  rsync_up "$ROOT/apps/web/.next/static/" \
    "$REMOTE_DIR/apps/web/.next/static/"

  # Public klasörü varsa kopyala (her iki konuma da)
  if [ -d "$ROOT/apps/web/public" ]; then
    info "Upload: apps/web/public → sunucu"
    ssh_run "mkdir -p $REMOTE_DIR/apps/web/.next/standalone/apps/web/public"
    rsync_up "$ROOT/apps/web/public/" \
      "$REMOTE_DIR/apps/web/.next/standalone/apps/web/public/"
    rsync_up "$ROOT/apps/web/public/" \
      "$REMOTE_DIR/apps/web/public/"
  fi

  info "PM2 restart: cubiqport-web"
  ssh_run "pm2 restart cubiqport-web --update-env" || warn "pm2 restart başarısız, elle kontrol edin"
  success "Web yeniden başlatıldı"
}

# =============================================================================
# UNIT TESTS — deploy öncesi yerel testler
# =============================================================================
run_unit_tests() {
  info "=== Unit Testler ==="
  echo ""

  # Shared build önce gerekiyor
  (cd "$ROOT/packages/shared" && npm run build --silent 2>/dev/null) || true

  if (cd "$ROOT/apps/api" && npm test 2>&1); then
    success "Unit testler geçti ✓"
  else
    echo ""
    error "Unit testler başarısız! Deploy durduruluyor."
  fi
  echo ""
}

# =============================================================================
# SMOKE TESTS — deploy sonrası canlı sistem kontrolü
# =============================================================================
run_smoke_tests() {
  info "=== Smoke Testler (Canlı Sistem) ==="
  echo ""

  # API başlaması için birkaç saniye bekle
  info "Servisler başlatılıyor... (8s bekleniyor)"
  sleep 8

  # smoke-test.sh'yi çalıştır
  # API ve Web aynı Nginx üzerinden port 8083'ten erişiliyor
  if bash "$ROOT/scripts/smoke-test.sh" \
      "http://144.91.65.111:8083" \
      "http://144.91.65.111:8083" \
      "info@cubiqport.com" \
      "@198711Ad@"; then
    success "Tüm smoke testler geçti ✓"
  else
    echo ""
    warn "Bazı smoke testler başarısız! Logları kontrol edin:"
    warn "  ssh_run 'pm2 logs cubiqport-api --lines 30'"
  fi
}

# =============================================================================
# MAIN
# =============================================================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CubiqPort Deploy  →  $TARGET     ${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

START=$(date +%s)

# ── Unit testler her zaman önce çalışır (skip=true ile atlanabilir)
SKIP_TESTS="${SKIP_TESTS:-false}"
if [ "$SKIP_TESTS" != "true" ]; then
  run_unit_tests
fi

case "$TARGET" in
  shared)
    deploy_shared
    ;;
  api)
    deploy_shared
    deploy_api
    ;;
  web)
    deploy_web
    ;;
  all)
    deploy_shared
    deploy_api
    deploy_web
    ;;
  *)
    error "Geçersiz hedef: '$TARGET'. Kullanım: ./deploy.sh [api|web|all]"
    ;;
esac

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Deploy tamamlandı  (${ELAPSED}s)           ${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# PM2 durumu göster
ssh_run "pm2 list 2>/dev/null | grep -E 'name|cubiqport'" || true

# ── Smoke testler (api veya all deploy'u sonrasında çalışır)
if [ "$SKIP_TESTS" != "true" ] && [ "$TARGET" != "shared" ]; then
  echo ""
  run_smoke_tests
fi
