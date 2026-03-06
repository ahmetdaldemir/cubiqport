#!/usr/bin/env bash
# =============================================================================
# CubiqPort Smoke Tests — Sunucuya deploy edilen sistemin temel sağlık kontrolü
# Kullanım: ./scripts/smoke-test.sh [API_URL] [WEB_URL] [ADMIN_EMAIL] [ADMIN_PASS]
# =============================================================================

# set -e kullanmıyoruz — pass/fail ile kendi hata yönetimimizi yapıyoruz
set -uo pipefail

# ── Varsayılan değerler ────────────────────────────────────────────────────────
API_URL="${1:-http://45.67.203.202:8083}"
WEB_URL="${2:-http://45.67.203.202:8083}"
ADMIN_EMAIL="${3:-admin@cubiqport.io}"
ADMIN_PASS="${4:-Admin1234!}"

# ── Renkler & yardımcılar ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=()

pass() { local msg="$1"; PASS_COUNT=$((PASS_COUNT+1)); RESULTS+=("${GREEN}  ✓${NC} $msg"); }
fail() { local msg="$1"; FAIL_COUNT=$((FAIL_COUNT+1)); RESULTS+=("${RED}  ✗${NC} $msg"); }
warn() { local msg="$1"; WARN_COUNT=$((WARN_COUNT+1)); RESULTS+=("${YELLOW}  ⚠${NC} $msg"); }

# HTTP isteği yap, durum kodu döndür
http_status() {
  curl -s -o /dev/null -w "%{http_code}" --connect-timeout 8 --max-time 15 "$@" 2>/dev/null || echo "000"
}

# HTTP isteği yap, yanıt body'sini döndür
http_body() {
  curl -s --connect-timeout 8 --max-time 15 "$@" 2>/dev/null || echo ""
}

# JSON'dan değer çıkar (jq yoksa sed fallback)
json_get() {
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$key // empty" 2>/dev/null || echo ""
  else
    # Basit regex fallback
    echo "$json" | sed -n "s/.*\"${key}\":\s*\"\([^\"]*\)\".*/\1/p" | head -1
  fi
}

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║         CubiqPort Smoke Tests                ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}API:${NC} $API_URL"
echo -e "  ${CYAN}WEB:${NC} $WEB_URL"
echo ""

# =============================================================================
# BÖLÜM 1: API Sağlık Kontrolleri
# =============================================================================
echo -e "${BOLD}── 1. API Sağlık Kontrolleri ──────────────────────${NC}"

# 1.1 Auth endpoint üzerinden API sağlık — geçersiz kimlik bilgisi → 401 beklenir
STATUS=$(http_status "$API_URL/api/v1/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"healthcheck@probe.internal","password":"wrongpass"}')
if [ "$STATUS" = "401" ] || [ "$STATUS" = "422" ]; then
  pass "API gateway yanıt veriyor → $STATUS"
else
  fail "API gateway erişilemiyor → $STATUS (beklenen: 401 veya 422)"
fi

# 1.2 Auth endpoint doğrulama — eksik şifre → 422
STATUS=$(http_status "$API_URL/api/v1/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}')
if [ "$STATUS" = "422" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /api/v1/auth/login (eksik şifre) → $STATUS (validation aktif)"
else
  fail "POST /api/v1/auth/login (eksik şifre) → $STATUS (beklenen: 422)"
fi

# 1.3 Korumalı endpoint — token olmadan 401 döndürmeli
STATUS=$(http_status "$API_URL/api/v1/servers")
if [ "$STATUS" = "401" ]; then
  pass "GET /api/v1/servers (anonim) → 401 Unauthorized ✓"
else
  fail "GET /api/v1/servers (anonim) → $STATUS (beklenen: 401)"
fi

# =============================================================================
# BÖLÜM 2: Kimlik Doğrulama Akışı
# =============================================================================
echo ""
echo -e "${BOLD}── 2. Kimlik Doğrulama Akışı ──────────────────────${NC}"

LOGIN_BODY=$(http_body "$API_URL/api/v1/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

# API yanıtı: {"success":true,"data":{"user":{...},"token":"..."}}
if command -v jq &>/dev/null; then
  TOKEN=$(echo "$LOGIN_BODY" | jq -r '.data.token // empty' 2>/dev/null || echo "")
else
  TOKEN=$(echo "$LOGIN_BODY" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' | head -1)
fi

if [ -n "$TOKEN" ] && [ ${#TOKEN} -gt 50 ]; then
  pass "POST /api/v1/auth/login → token alındı (${#TOKEN} karakter)"
else
  fail "POST /api/v1/auth/login → token alınamadı. Yanıt: ${LOGIN_BODY:0:200}"
  TOKEN=""
fi

# =============================================================================
# BÖLÜM 3: Korumalı API Endpoint'leri
# =============================================================================
echo ""
echo -e "${BOLD}── 3. Korumalı API Endpoint'leri ──────────────────${NC}"

if [ -n "$TOKEN" ]; then
  AUTH_HDR="Authorization: Bearer $TOKEN"

  # 3.1 Sunucu listesi
  STATUS=$(http_status "$API_URL/api/v1/servers" -H "$AUTH_HDR")
  [ "$STATUS" = "200" ] && pass "GET /api/v1/servers → 200 OK" || fail "GET /api/v1/servers → $STATUS"

  # 3.2 Domain listesi
  STATUS=$(http_status "$API_URL/api/v1/domains" -H "$AUTH_HDR")
  [ "$STATUS" = "200" ] && pass "GET /api/v1/domains → 200 OK" || fail "GET /api/v1/domains → $STATUS"

  # 3.3 Abonelik bilgisi
  STATUS=$(http_status "$API_URL/api/v1/billing/subscription" -H "$AUTH_HDR")
  [ "$STATUS" = "200" ] && pass "GET /api/v1/billing/subscription → 200 OK" || fail "GET /api/v1/billing/subscription → $STATUS"

  # 3.4 Fatura bilgisi
  STATUS=$(http_status "$API_URL/api/v1/billing/info" -H "$AUTH_HDR")
  [ "$STATUS" = "200" ] && pass "GET /api/v1/billing/info → 200 OK" || fail "GET /api/v1/billing/info → $STATUS"

  # 3.5 Fatura listesi
  STATUS=$(http_status "$API_URL/api/v1/billing/invoices" -H "$AUTH_HDR")
  [ "$STATUS" = "200" ] && pass "GET /api/v1/billing/invoices → 200 OK" || fail "GET /api/v1/billing/invoices → $STATUS"

  # 3.6 Admin stats (superadmin veya yetkisiz → 200 ya da 403 beklenir, 500 değil)
  STATUS=$(http_status "$API_URL/api/v1/admin/stats" -H "$AUTH_HDR")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then
    pass "GET /api/v1/admin/stats → $STATUS (API yanıt veriyor)"
  else
    fail "GET /api/v1/admin/stats → $STATUS (beklenen: 200 veya 403, 500 değil)"
  fi

  # 3.7 Monitoring endpoint
  STATUS=$(http_status "$API_URL/api/v1/monitoring/servers" -H "$AUTH_HDR")
  [ "$STATUS" = "200" ] && pass "GET /api/v1/monitoring/servers → 200 OK" || warn "GET /api/v1/monitoring/servers → $STATUS"

else
  warn "Token alınamadığı için korumalı endpoint testleri atlandı"
fi

# =============================================================================
# BÖLÜM 4: Input Validation (Yeni Fastify Şemaları)
# =============================================================================
echo ""
echo -e "${BOLD}── 4. Input Validation Kontrolleri ────────────────${NC}"

if [ -n "$TOKEN" ]; then
  AUTH_HDR="Authorization: Bearer $TOKEN"

  # 4.1 Geçersiz checkout plan → 422 (Fastify schema validation)
  STATUS=$(http_status "$API_URL/api/v1/billing/checkout" \
    -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
    -d '{"plan":"weekly"}')
  if [ "$STATUS" = "422" ] || [ "$STATUS" = "400" ]; then
    pass "POST /api/v1/billing/checkout (geçersiz plan) → $STATUS (validation çalışıyor)"
  else
    warn "POST /api/v1/billing/checkout (geçersiz plan) → $STATUS (beklenen: 422)"
  fi

  # 4.2 Tech install — eksik techId → 422
  # Önce bir sunucu ID'si al
  SERVERS_BODY=$(http_body "$API_URL/api/v1/servers" -H "$AUTH_HDR")
  SERVER_ID=$(echo "$SERVERS_BODY" | grep -o '"id":"[^"]*"' 2>/dev/null | head -1 | cut -d'"' -f4 || echo "")

  if [ -n "$SERVER_ID" ]; then
    STATUS=$(http_status "$API_URL/api/v1/servers/$SERVER_ID/technologies/install" \
      -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
      -d '{"version":"latest"}')
    if [ "$STATUS" = "422" ] || [ "$STATUS" = "400" ]; then
      pass "POST /technologies/install (eksik techId) → $STATUS (validation çalışıyor)"
    else
      warn "POST /technologies/install (eksik techId) → $STATUS (beklenen: 422)"
    fi
  else
    warn "Sunucu bulunamadı — tech validation testi atlandı"
  fi
else
  warn "Token alınamadığı için validation testleri atlandı"
fi

# =============================================================================
# BÖLÜM 5: Web Frontend Erişilebilirliği
# =============================================================================
echo ""
echo -e "${BOLD}── 5. Web Frontend Kontrolleri ────────────────────${NC}"

# 5.1 Ana sayfa
STATUS=$(http_status "$WEB_URL/")
[ "$STATUS" = "200" ] && pass "GET / (landing) → 200 OK" || fail "GET / → $STATUS"

# 5.2 Login sayfası
STATUS=$(http_status "$WEB_URL/login")
[ "$STATUS" = "200" ] && pass "GET /login → 200 OK" || fail "GET /login → $STATUS"

# 5.3 Dashboard (redirect veya 200 beklenir)
STATUS=$(http_status "$WEB_URL/dashboard")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
  pass "GET /dashboard → $STATUS"
else
  warn "GET /dashboard → $STATUS"
fi

# 5.4 Sunucular sayfası
STATUS=$(http_status "$WEB_URL/servers")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
  pass "GET /servers → $STATUS"
else
  warn "GET /servers → $STATUS"
fi

# 5.5 Billing sayfası
STATUS=$(http_status "$WEB_URL/billing")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
  pass "GET /billing → $STATUS"
else
  warn "GET /billing → $STATUS"
fi

# 5.6 Admin sayfası
STATUS=$(http_status "$WEB_URL/admin")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
  pass "GET /admin → $STATUS"
else
  warn "GET /admin → $STATUS"
fi

# =============================================================================
# BÖLÜM 6: Güvenlik Kontrolleri
# =============================================================================
echo ""
echo -e "${BOLD}── 6. Güvenlik Kontrolleri ────────────────────────${NC}"

# 6.1 Rate limiting header mevcut mu
HEADERS=$(curl -s -I --connect-timeout 8 --max-time 10 "$API_URL/health" 2>/dev/null || echo "")
if echo "$HEADERS" | grep -qi "x-ratelimit"; then
  pass "Rate-limit headerları mevcut"
else
  warn "Rate-limit headerları görünmüyor (test ortamında atlanmış olabilir)"
fi

# 6.2 Geçersiz email formatı → 422 beklenir (500 değil — Fastify validation)
STATUS=$(http_status "$API_URL/api/v1/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"somepass"}')
if [ "$STATUS" = "422" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "Geçersiz email formatı → $STATUS (güvenli yanıt ✓)"
else
  fail "Geçersiz email formatı → $STATUS (beklenen: 422 veya 401)"
fi

# 6.3 Var olmayan API endpoint → 404 beklenir (500 değil)
STATUS=$(http_status "$API_URL/api/v1/nonexistent-endpoint-xyz")
if [ "$STATUS" = "404" ] || [ "$STATUS" = "401" ]; then
  pass "Var olmayan endpoint → $STATUS (güvenli yanıt ✓)"
else
  fail "Var olmayan endpoint → $STATUS (beklenen: 404 veya 401)"
fi

# =============================================================================
# SONUÇ
# =============================================================================
echo ""
echo -e "${BOLD}── Sonuçlar ────────────────────────────────────────${NC}"
for r in "${RESULTS[@]}"; do
  echo -e "$r"
done

TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo ""
echo -e "${BOLD}  Toplam: $TOTAL test${NC}"
echo -e "  ${GREEN}Geçti:   $PASS_COUNT${NC}"
echo -e "  ${RED}Başarısız: $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Uyarı:   $WARN_COUNT${NC}"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ✓ Tüm kritik testler geçti!${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}  ✗ $FAIL_COUNT test başarısız!${NC}"
  exit 1
fi
