#!/usr/bin/env bash
# CubiqPort API sunucusundan (45.67.203.202) hedef sunucuya SSH testi.
# Kullanım: API sunucusunda çalıştırın:
#   ssh root@45.67.203.202
#   cd /var/www/html && bash scripts/test-ssh-from-api-server.sh HEDEF_IP [ŞIFRE]
# Şifre verilmezse ortam değişkeni SSH_PASS kullanılır.
set -euo pipefail
TARGET="${1:?Hedef IP gerekli (örn. 144.91.65.111)}"
PASS="${2:-${SSH_PASS:-}}"
if [ -z "$PASS" ]; then
  echo "Şifre gerekli: $0 HEDEF_IP ŞIFRE"
  echo "veya: SSH_PASS=şifre $0 HEDEF_IP"
  exit 1
fi
if ! command -v sshpass &>/dev/null; then
  echo "sshpass yüklü değil. Yükleyin: apt install sshpass"
  exit 1
fi
echo "Test: root@${TARGET} (CubiqPort sunucusundan)"
if sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o PreferredAuthentications=password -o PubkeyAuthentication=no root@"$TARGET" "echo OK"; then
  echo "✓ SSH başarılı (bu sunucudan şifre ile giriş çalışıyor)."
else
  echo "✗ SSH başarısız. Kontrol edin:"
  echo "  - Hedef sunucuda PasswordAuthentication yes"
  echo "  - Firewall: 45.67.203.202 → ${TARGET}:22 açık mı?"
  echo "  - Şifre doğru mu?"
  exit 1
fi
