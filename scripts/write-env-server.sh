#!/usr/bin/env bash
# Sunucuda /var/www/html/.env oluşturur (güvenli secret üretir).
# Çalıştırma: sunucuda root olarak: bash write-env-server.sh
set -e
cd /var/www/html
JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENC=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
AGENT=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
cat > .env << EOF
NODE_ENV=production
API_PORT=4000
API_HOST=0.0.0.0
DATABASE_URL=postgresql://dev_user:dev_pass@127.0.0.1:5432/cubiqport
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=$JWT
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=$ENC
AGENT_PORT=9000
AGENT_SECRET=$AGENT
API_INTERNAL_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=https://cubiqport.com
EOF
chmod 600 .env
echo ".env created."
