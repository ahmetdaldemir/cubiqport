import { NodeSSH } from 'node-ssh';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export interface SshConnectionOptions {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

/**
 * Tests an SSH connection by running a simple command.
 * Throws AppError if the connection fails.
 */
export async function testSshConnection(opts: SshConnectionOptions): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      privateKey: opts.privateKey,
      readyTimeout: 10_000,
    });
    const result = await ssh.execCommand('echo ok');
    if (result.stdout.trim() !== 'ok') {
      throw new AppError('SSH test command returned unexpected output', 502);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AppError(`SSH connection failed: ${message}`, 502, 'SSH_ERROR');
  } finally {
    ssh.dispose();
  }
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Executes a single command on a remote server.
 */
export async function runRemoteCommand(
  opts: SshConnectionOptions,
  command: string,
): Promise<CommandResult> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      privateKey: opts.privateKey,
      readyTimeout: 15_000,
    });
    const result = await ssh.execCommand(command);
    return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 };
  } finally {
    ssh.dispose();
  }
}

/**
 * Installs the CubiqPort agent on a remote server.
 * Runs a bootstrap script that installs docker, nginx, certbot, node and the agent.
 */
export async function installAgent(opts: SshConnectionOptions): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      privateKey: opts.privateKey,
      readyTimeout: 15_000,
    });

    const bootstrapScript = `
set -e

# ── Install dependencies ───────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq curl gnupg2 ca-certificates lsb-release

# ── Docker ────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# ── Nginx ─────────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
  systemctl enable --now nginx
fi

# ── Certbot ───────────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi

# ── Node.js 20 ────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || ! node -e "require('assert').ok(+process.versions.node.split('.')[0] >= 20)"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

# ── CubiqPort Agent ───────────────────────────────────────────────────
if ! command -v cubiq-agent &>/dev/null; then
  npm install -g @cubiqport/agent --registry https://registry.npmjs.org || true
fi

# ── Systemd service ───────────────────────────────────────────────────
cat > /etc/systemd/system/cubiq-agent.service <<'SERVICE'
[Unit]
Description=CubiqPort Agent
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/env node /usr/local/lib/node_modules/@cubiqport/agent/dist/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=AGENT_PORT=9000

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable cubiq-agent
systemctl restart cubiq-agent || true

echo "Agent installed successfully"
`;

    const result = await ssh.execCommand(`bash -s <<'EOF'\n${bootstrapScript}\nEOF`);
    if (result.code !== 0) {
      logger.error({ stderr: result.stderr }, 'Agent installation failed');
      throw new AppError(`Agent installation failed: ${result.stderr}`, 500, 'INSTALL_ERROR');
    }
    logger.info('Agent installed successfully');
  } finally {
    ssh.dispose();
  }
}
