#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CubiqPort — Seed the default (self-hosted) server
# Runs on: 45.67.203.202 as root
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API="http://127.0.0.1:4000/api/v1"
KEY_FILE="/root/.ssh/cubiqport_id_rsa"
SERVER_NAME="Production Server (self)"
SERVER_IP="45.67.203.202"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " CubiqPort — Seeding default server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Generate SSH key ───────────────────────────────────────────────────────
if [ ! -f "$KEY_FILE" ]; then
  echo "[1/4] Generating SSH key…"
  ssh-keygen -t ed25519 -N '' -f "$KEY_FILE" -C "cubiqport-panel"
  echo "  Generated: $KEY_FILE"
else
  echo "[1/4] SSH key already exists: $KEY_FILE"
fi

# ── 2. Add to authorized_keys ─────────────────────────────────────────────────
echo "[2/4] Authorizing key for root@localhost…"
mkdir -p /root/.ssh
chmod 700 /root/.ssh
cat "$KEY_FILE.pub" >> /root/.ssh/authorized_keys
sort -u /root/.ssh/authorized_keys -o /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
echo "  authorized_keys updated"

# Verify localhost SSH works
if ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
     root@127.0.0.1 "echo 'SSH_SELF_OK'" 2>/dev/null | grep -q 'SSH_SELF_OK'; then
  echo "  ✓ Self-SSH verified"
else
  echo "  ✗ Self-SSH failed. Check sshd configuration." >&2
  exit 1
fi

# ── 3. Get auth token ─────────────────────────────────────────────────────────
echo "[3/4] Authenticating with CubiqPort API…"
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cubiqport.io","password":"Admin1234!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const j = JSON.parse(d);
  if (j.data?.token) { process.stdout.write(j.data.token); }
  else { console.error('Login failed:', JSON.stringify(j)); process.exit(1); }
")

echo "  ✓ Token obtained"

# ── 4. Create server via API ──────────────────────────────────────────────────
echo "[4/4] Creating server record…"
PRIVATE_KEY=$(cat "$KEY_FILE")

# Build JSON payload with jq if available, otherwise use node
SERVER_PAYLOAD=$(node -e "
const key = require('fs').readFileSync('$KEY_FILE', 'utf8');
console.log(JSON.stringify({
  name: '$SERVER_NAME',
  ip: '$SERVER_IP',
  sshPort: 22,
  sshUser: 'root',
  sshKey: key
}));
")

CREATE_RESPONSE=$(curl -s -X POST "$API/servers" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SERVER_PAYLOAD")

SERVER_ID=$(echo "$CREATE_RESPONSE" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const j = JSON.parse(d);
  if (j.data?.id) { process.stdout.write(j.data.id); }
  else if (j.error?.includes('already') || j.error?.includes('duplicate') || j.error?.includes('unique')) {
    console.error('Server already exists — skipping.');
    process.exit(0);
  } else { console.error('Create failed:', JSON.stringify(j)); process.exit(1); }
" 2>&1 || true)

if [ -z "$SERVER_ID" ]; then
  echo "  Server may already exist — skipping duplicate."
else
  echo "  ✓ Server created with ID: $SERVER_ID"

  # Test connection to verify
  echo "  Testing SSH connection via CubiqPort API…"
  TEST_RESPONSE=$(curl -s -X POST "$API/servers/$SERVER_ID/test-connection" \
    -H "Authorization: Bearer $TOKEN")
  echo "  Test result: $(echo "$TEST_RESPONSE" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(j.data?.status ?? j.error)")"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✓  Default server seeded!"
echo "    Dashboard → http://45.67.203.202:8083/servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
