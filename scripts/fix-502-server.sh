#!/usr/bin/env bash
# =============================================================================
# 502 Bad Gateway düzeltme — SUNUCUDA çalıştır (root veya sudo)
# Nginx'in /api/ isteklerini 127.0.0.1:4000'e yönlendirmesi ve API'nin ayakta olması gerekir.
# =============================================================================

set -euo pipefail

echo "=== 1. PM2: API ve Web çalışıyor mu? ==="
pm2 list | grep -E "cubiqport-api|cubiqport-web" || true
if ! pm2 describe cubiqport-api 2>/dev/null | grep -q "online"; then
  echo "cubiqport-api çalışmıyor. Başlat: cd /var/www/html && pm2 start ecosystem.config.cjs --only cubiqport-api"
  pm2 start /var/www/html/ecosystem.config.cjs --only cubiqport-api 2>/dev/null || true
fi
if ! pm2 describe cubiqport-web 2>/dev/null | grep -q "online"; then
  echo "cubiqport-web çalışmıyor. Başlat: pm2 start ecosystem.config.cjs --only cubiqport-web"
  cd /var/www/html && pm2 start ecosystem.config.cjs --only cubiqport-web 2>/dev/null || true
fi

echo ""
echo "=== 2. Port 4000 dinleniyor mu? ==="
ss -tlnp | grep 4000 || netstat -tlnp 2>/dev/null | grep 4000 || echo "4000 dinlenmiyor — API başlamamış olabilir."

echo ""
echo "=== 3. Yerel API sağlık kontrolü ==="
curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:4000/health || echo " (API yanıt vermiyor)"

echo ""
echo "=== 4. Nginx — CubiqPort config aktif mi? ==="
NGINX_CONF="/etc/nginx/sites-available/cubiqport"
NGINX_ENABLED="/etc/nginx/sites-enabled/cubiqport"
if [ -f "$NGINX_CONF" ]; then
  echo "Config var: $NGINX_CONF"
  [ -L "$NGINX_ENABLED" ] || [ -f "$NGINX_ENABLED" ] && echo "sites-enabled'da mevcut." || echo "sites-enabled'da YOK — aşağıdaki komutları çalıştır."
else
  echo "Config yok. Kopyala: cp /var/www/html/scripts/nginx-cubiqport.conf $NGINX_CONF"
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
  cp /var/www/html/scripts/nginx-cubiqport.conf /etc/nginx/sites-available/cubiqport 2>/dev/null || true
fi

if [ ! -L "$NGINX_ENABLED" ] && [ ! -f "$NGINX_ENABLED" ]; then
  echo ""
  echo "Nginx'e CubiqPort ekleniyor..."
  ln -sf /etc/nginx/sites-available/cubiqport /etc/nginx/sites-enabled/cubiqport 2>/dev/null || true
  nginx -t && systemctl reload nginx && echo "Nginx yeniden yüklendi."
fi

echo ""
echo "=== 5. Son kontrol: curl http://127.0.0.1:4000/health ==="
curl -s --connect-timeout 3 http://127.0.0.1:4000/health || echo "API 4000'de yanıt yok — pm2 logs cubiqport-api ile hata kontrol et."
