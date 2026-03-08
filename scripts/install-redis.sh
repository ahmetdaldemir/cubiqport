#!/usr/bin/env bash
# =============================================================================
# Redis kurulumu — Linux (Ubuntu/Debian) veya macOS (Homebrew)
# Kullanım:
#   Linux:  sudo ./scripts/install-redis.sh
#   macOS:  ./scripts/install-redis.sh  (brew gerekir)
# CubiqPort: analiz kuyruğu ve metrik önbelleği. REDIS_URL yoksa uygulama yine çalışır.
# =============================================================================

set -euo pipefail

REDIS_URL_DEFAULT="redis://127.0.0.1:6379"

install_linux() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Linux'ta root gerekir: sudo $0"
    exit 1
  fi
  echo "[Redis] Paket listesi güncelleniyor..."
  apt-get update -qq
  echo "[Redis] redis-server kuruluyor..."
  apt-get install -y redis-server
  echo "[Redis] Servis başlatılıyor..."
  systemctl enable redis-server 2>/dev/null || systemctl enable redis 2>/dev/null || true
  systemctl start redis-server 2>/dev/null || systemctl start redis 2>/dev/null || true
  if systemctl is-active --quiet redis-server 2>/dev/null || systemctl is-active --quiet redis 2>/dev/null; then
    echo "[Redis] Servis çalışıyor."
  else
    echo "[Redis] Uyarı: systemctl ile başlatılamadı. Elle: systemctl start redis-server"
  fi
}

install_macos() {
  if ! command -v brew &>/dev/null; then
    echo "Homebrew yüklü değil. Önce: https://brew.sh"
    exit 1
  fi
  echo "[Redis] Homebrew ile Redis kuruluyor..."
  brew install redis
  echo "[Redis] Servis başlatılıyor (brew services)..."
  brew services start redis
  echo "[Redis] Redis çalışıyor (port 6379)."
}

# ─── Ana ────────────────────────────────────────────────────────────────────
echo "Redis kurulumu — CubiqPort"
echo ""

case "$(uname -s)" in
  Linux)
    install_linux
    ;;
  Darwin)
    install_macos
    ;;
  *)
    echo "Desteklenmeyen işletim sistemi: $(uname -s). Sadece Linux ve macOS desteklenir."
    exit 1
    ;;
esac

# Çalışıyor mu kontrol et
if command -v redis-cli &>/dev/null; then
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo ""
    echo "Redis yanıt veriyor (redis-cli ping -> PONG)."
  else
    echo ""
    echo "Redis kuruldu ama ping yanıt vermedi. Birkaç saniye bekleyip tekrar deneyin: redis-cli ping"
  fi
else
  echo "redis-cli bulunamadı; bağlantı kontrolü atlandı."
fi

echo ""
echo "--- .env dosyana ekle ---"
echo "REDIS_URL=$REDIS_URL_DEFAULT"
echo ""
echo "Şifre koymak istersen (Linux): /etc/redis/redis.conf içinde requirepass xxx"
echo "Sonra: REDIS_URL=redis://:xxx@127.0.0.1:6379"
echo ""
