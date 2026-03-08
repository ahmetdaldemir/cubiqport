#!/usr/bin/env bash
# =============================================================================
# 502 düzeltme — SUNUCUDA BİR KEZ çalıştır: sudo /var/www/html/scripts/setup-nginx-once.sh
# Nginx'i /api/ → 127.0.0.1:4000 ve / → 127.0.0.1:3000 olacak şekilde ayarlar.
# =============================================================================

set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/var/www/html}"
BACKUP_DIR="$REMOTE_DIR/scripts/nginx-backup-$(date +%Y%m%d-%H%M%S)"

echo "[1/5] Mevcut Nginx config yedekleniyor: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/" 2>/dev/null || true
cp -r /etc/nginx/sites-available "$BACKUP_DIR/" 2>/dev/null || true

echo "[2/5] CubiqPort HTTPS config kopyalanıyor..."
mkdir -p /etc/nginx/sites-available
cp "$REMOTE_DIR/scripts/nginx-cubiqport-443.conf" /etc/nginx/sites-available/cubiqport-443

echo "[3/5] Eski CubiqPort nginx siteleri devre dışı bırakılıyor..."
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in cubiqport*) rm -f "$f" && echo "  Kaldırıldı: $f" ;; esac
done

echo "[4/5] Yeni config aktif ediliyor..."
ln -sf /etc/nginx/sites-available/cubiqport-443 /etc/nginx/sites-enabled/cubiqport-443

echo "[5/5] Nginx test ve reload..."
if nginx -t 2>&1; then
  systemctl reload nginx
  echo ""
  echo "Tamam. /api/ artık 127.0.0.1:4000'e gidiyor. Test: curl -sI https://cubiqport.com/api/v1/auth/login"
else
  echo "nginx -t başarısız. Eski config geri yüklemek için: cp -r $BACKUP_DIR/sites-enabled/* /etc/nginx/sites-enabled/ && systemctl reload nginx"
  exit 1
fi
