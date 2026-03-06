import { NodeSSH } from 'node-ssh';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export interface SshConnectionOptions {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

export function buildConnectConfig(opts: SshConnectionOptions) {
  const base = {
    host: opts.host,
    port: opts.port,
    username: opts.username,
    readyTimeout: 15_000,
  };
  if (opts.password) {
    const password = opts.password;
    return {
      ...base,
      password,
      tryKeyboard: true,
      tryAgent: false,
      onKeyboardInteractive: (_name: string, _instructions: string, _lang: string, prompts: { prompt: string }[], finish: (responses: string[]) => void) => {
        finish(prompts.map(() => password));
      },
    };
  }
  return { ...base, privateKey: opts.privateKey };
}

/**
 * Tests an SSH connection by running a simple command.
 * Throws AppError if the connection fails.
 */
export async function testSshConnection(opts: SshConnectionOptions): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
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
    await ssh.connect(buildConnectConfig(opts));
    const result = await ssh.execCommand(command);
    return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 };
  } finally {
    ssh.dispose();
  }
}

export interface ScannedDomain {
  domain: string;
  rootPath: string;
  sslEnabled: boolean;
}

/**
 * Scans nginx sites-enabled on the remote server and returns discovered domains.
 * Excludes default/cubiqport/port8083 configs that belong to the panel itself.
 */
// ─── Full Server Scan ─────────────────────────────────────────────────────────

export interface ServerScanResult {
  os?: string;
  uptime?: string;
  ramTotal?: string;
  ramUsed?: string;
  diskUsedPct?: string;
  technologies: { name: string; version: string; status: string }[];
  databases: string[];
  nginxDomains: string[];
  nginxDomainDetails: { domain: string; rootPath: string }[];
  containers: { name: string; image: string; status: string }[];
}

export async function scanServer(opts: SshConnectionOptions): Promise<ServerScanResult> {
  const script = `python3 - <<'PYEOF'
import json, subprocess, os, re, sys

def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (r.stdout or '').strip()
    except Exception:
        return ''

result = {}
techs = []
domain_details = {}  # {domain: rootPath}

# OS
try:
    with open('/etc/os-release') as f:
        for line in f:
            if line.startswith('PRETTY_NAME='):
                result['os'] = line.split('=',1)[1].strip().strip('"')
                break
except: pass

# System stats
result['uptime'] = run('uptime -p 2>/dev/null || uptime')
result['ramTotal'] = run("free -h 2>/dev/null | awk '/^Mem:/{print $2}'")
result['ramUsed']  = run("free -h 2>/dev/null | awk '/^Mem:/{print $3}'")
result['diskUsedPct'] = run("df -h / 2>/dev/null | tail -1 | awk '{print $5}'")

def is_valid_domain(name):
    name = name.strip()
    return ('.' in name and not name.startswith('_') and not name.startswith('*')
            and name != 'localhost' and not re.match(r'^\\d+\\.\\d+\\.\\d+\\.\\d+$', name))

def detect_webroot(domain_name, hint=''):
    """Find the actual web root directory for a domain."""
    # 1. Use nginx config hint if valid
    if hint and os.path.isdir(hint):
        return hint
    # 2. Common paths - check if they exist
    candidates = [
        hint,
        f'/var/www/html/{domain_name}',
        f'/var/www/{domain_name}/html',
        f'/var/www/{domain_name}',
        f'/var/www/html',
        f'/srv/www/{domain_name}',
        f'/home/www/{domain_name}',
        f'/opt/www/{domain_name}',
    ]
    for path in candidates:
        if path and os.path.isdir(path):
            return path
    # 3. Fallback: use hint if provided, else /var/www/{domain}
    return hint or f'/var/www/{domain_name}'

def parse_nginx_blocks(conf_text):
    """Parse nginx server blocks and return list of {domain, rootPath} dicts."""
    details = []
    # Split on top-level server { blocks (simple brace-counting approach)
    blocks = re.split(r'(?:^|\\n)\\s*server\\s*\\{', conf_text)
    for block in blocks[1:]:
        sn_m = re.search(r'server_name\\s+([^;]+);', block)
        root_m = re.search(r'(?:^|\\n)\\s*root\\s+([^;\\n]+);', block)
        if not sn_m:
            continue
        root_hint = root_m.group(1).strip() if root_m else ''
        for name in sn_m.group(1).split():
            if is_valid_domain(name):
                details.append({'domain': name, 'rootHint': root_hint})
    return details

def merge_domain_details(new_details):
    for d in new_details:
        domain = d['domain']
        if domain not in domain_details or not domain_details[domain]:
            domain_details[domain] = d.get('rootHint', '')

# ── Host Nginx ────────────────────────────────────────────────────────────────
nginx_host = run('nginx -v 2>&1')
host_has_nginx = nginx_host and 'not found' not in nginx_host and 'No such' not in nginx_host
if host_has_nginx:
    v = re.sub(r'nginx version: nginx/', '', nginx_host).replace('nginx version: ','').strip()
    st = run('systemctl is-active nginx 2>/dev/null') or 'installed'
    techs.append({'name':'Nginx','version':v,'status':st})
    # sites-enabled / conf.d
    for sdir in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
        if os.path.isdir(sdir):
            skip = {'default','cubiqport','port8083'}
            for fn in os.listdir(sdir):
                if fn in skip: continue
                fp = os.path.join(sdir, fn)
                try:
                    with open(fp) as f:
                        txt = f.read()
                        merge_domain_details(parse_nginx_blocks(txt))
                        # filename fallback if no server_name found
                        if not any(is_valid_domain(d) for d in [fn]) and '.' in fn:
                            if fn not in domain_details:
                                domain_details[fn] = ''
                except: pass
    # nginx -T full dump
    nginx_dump = run('nginx -T 2>/dev/null', timeout=8)
    if nginx_dump:
        merge_domain_details(parse_nginx_blocks(nginx_dump))

# ── Docker ───────────────────────────────────────────────────────────────────
dv = run('docker --version 2>/dev/null')
docker_ok = dv and 'not found' not in dv
if docker_ok:
    v = dv.replace('Docker version ','').split(',')[0]
    st = run('systemctl is-active docker 2>/dev/null') or 'installed'
    techs.append({'name':'Docker','version':v,'status':st})
    raw = run("docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null")
    containers = []
    nginx_containers = []
    for line in raw.split('\\n'):
        if '|' in line:
            p = line.split('|')
            cname, image, cstatus = p[0], p[1], p[2]
            containers.append({'name': cname, 'image': image, 'status': cstatus})
            # detect nginx containers
            if 'nginx' in image.lower() or 'nginx' in cname.lower():
                nginx_containers.append(cname)
    result['containers'] = containers

    # ── Nginx inside Docker containers ────────────────────────────────────────
    for cname in nginx_containers:
        conf = run(f'docker exec {cname} nginx -T 2>/dev/null', timeout=8)
        if not conf:
            for cpath in ['/etc/nginx/conf.d', '/etc/nginx/sites-enabled', '/etc/nginx/http.d']:
                ls = run(f'docker exec {cname} ls {cpath} 2>/dev/null')
                for fn in ls.split():
                    fc = run(f'docker exec {cname} cat {cpath}/{fn} 2>/dev/null')
                    merge_domain_details(parse_nginx_blocks(fc))
        else:
            merge_domain_details(parse_nginx_blocks(conf))
        if not host_has_nginx:
            nv_c = run(f'docker exec {cname} nginx -v 2>&1')
            if nv_c and 'not found' not in nv_c:
                v = re.sub(r'nginx version: nginx/', '', nv_c).strip()
                if not any(t['name'] == 'Nginx' for t in techs):
                    techs.append({'name':'Nginx','version':v,'status':'docker'})

    # ── DBs inside Docker containers ─────────────────────────────────────────
    db_images = {
        'postgres': 'PostgreSQL', 'mysql': 'MySQL', 'mariadb': 'MariaDB',
        'mongo': 'MongoDB', 'redis': 'Redis',
    }
    docker_dbs = []
    for c in containers:
        img_lower = c['image'].lower()
        for key, label in db_images.items():
            if key in img_lower:
                docker_dbs.append(label)
                break
    if docker_dbs and 'databases' not in result:
        result['dockerDbs'] = list(set(docker_dbs))

# ── Host Databases ────────────────────────────────────────────────────────────
pgv = run('psql --version 2>/dev/null')
pg_active = run('systemctl is-active postgresql 2>/dev/null') == 'active'
if pgv or pg_active:
    v = pgv.replace('psql (PostgreSQL) ','').strip() if pgv else 'unknown'
    techs.append({'name':'PostgreSQL','version':v,'status':'active' if pg_active else 'installed'})
    dbs_raw = run("psql -U postgres -t -c \\\"SELECT datname FROM pg_database WHERE datistemplate=false AND datname<>'postgres';\\\" 2>/dev/null")
    result['databases'] = [d.strip() for d in dbs_raw.split('\\n') if d.strip()]

mv_raw = run('mysql --version 2>/dev/null')
if mv_raw and 'not found' not in mv_raw:
    # extract version number properly
    mv_match = re.search(r'[\\d]+\\.[\\d]+\\.[\\d]+', mv_raw)
    mv = mv_match.group(0) if mv_match else mv_raw.split()[0]
    st = run('systemctl is-active mysql 2>/dev/null') or run('systemctl is-active mariadb 2>/dev/null') or 'installed'
    if 'mariadb' in mv_raw.lower():
        techs.append({'name':'MariaDB','version':mv,'status':st})
    else:
        techs.append({'name':'MySQL','version':mv,'status':st})

rv = run('redis-cli --version 2>/dev/null')
if rv and 'not found' not in rv:
    rv_match = re.search(r'[\\d]+\\.[\\d]+\\.[\\d]+', rv)
    st = run('systemctl is-active redis 2>/dev/null') or run('systemctl is-active redis-server 2>/dev/null') or 'installed'
    techs.append({'name':'Redis','version':rv_match.group(0) if rv_match else rv,'status':st})

mongov = run('mongod --version 2>/dev/null')
if mongov and 'not found' not in mongov:
    mv_match = re.search(r'[\\d]+\\.[\\d]+\\.[\\d]+', mongov)
    st = run('systemctl is-active mongod 2>/dev/null') or 'installed'
    techs.append({'name':'MongoDB','version':mv_match.group(0) if mv_match else '','status':st})

# ── Languages ────────────────────────────────────────────────────────────────
nj = run('node --version 2>/dev/null')
if nj and 'not found' not in nj:
    techs.append({'name':'Node.js','version':nj,'status':'installed'})

phpv = run('php --version 2>/dev/null')
if phpv and 'not found' not in phpv:
    v = phpv.split('\\n')[0]
    pv_match = re.search(r'PHP ([\\d]+\\.[\\d]+\\.[\\d]+)', v)
    techs.append({'name':'PHP','version':pv_match.group(1) if pv_match else v,'status':'installed'})

pyv = run('python3 --version 2>/dev/null')
if pyv and 'not found' not in pyv:
    techs.append({'name':'Python','version':pyv.replace('Python ',''),'status':'installed'})

# ── Result assembly ───────────────────────────────────────────────────────────
if 'databases' not in result:
    result['databases'] = []
if 'containers' not in result:
    result['containers'] = []

# Resolve actual root paths and build final domain list
skip_domains = {'default','cubiqport','port8083','localhost'}
nginx_domain_details = []
for domain, root_hint in domain_details.items():
    if domain in skip_domains: continue
    actual_root = detect_webroot(domain, root_hint)
    nginx_domain_details.append({'domain': domain, 'rootPath': actual_root})

result['nginxDomains'] = sorted(d['domain'] for d in nginx_domain_details)
result['nginxDomainDetails'] = nginx_domain_details
result['technologies'] = techs
print(json.dumps(result))
PYEOF`;

  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(script);
    const out = res.stdout.trim();
    if (!out) {
      logger.warn({ stderr: res.stderr }, 'Server scan returned no output');
      return { technologies: [], databases: [], nginxDomains: [], nginxDomainDetails: [], containers: [] };
    }
    const parsed = JSON.parse(out) as ServerScanResult;
    logger.info({ host: opts.host }, 'Server scan complete');
    return parsed;
  } catch (err) {
    logger.warn({ err }, 'Server scan failed — returning empty result');
    return { technologies: [], databases: [], nginxDomains: [], nginxDomainDetails: [], containers: [] };
  } finally {
    ssh.dispose();
  }
}

export async function scanNginxDomains(opts: SshConnectionOptions): Promise<ScannedDomain[]> {
  const script = `
SKIP="default cubiqport port8083"
for f in /etc/nginx/sites-enabled/*; do
  base=$(basename "$f")
  echo "$SKIP" | grep -qw "$base" && continue
  # server_name (first non-wildcard value)
  sname=$(grep -m1 'server_name' "$f" 2>/dev/null | awk '{print $2}' | tr -d ';')
  [ -z "$sname" ] || [ "$sname" = "_" ] && continue
  # strip leading www.
  domain=$(echo "$sname" | sed 's/^www\\.//g')
  # root path
  rootp=$(grep -m1 '^\s*root ' "$f" 2>/dev/null | awk '{print $2}' | tr -d ';')
  [ -z "$rootp" ] && rootp="/var/www/$domain"
  # strip trailing html/public
  rootp=$(echo "$rootp" | sed 's|/html/public$||; s|/public$||; s|/html$||')
  # SSL
  ssl=0
  grep -q 'ssl_certificate' "$f" 2>/dev/null && ssl=1
  echo "DOMAIN|$domain|$rootp|$ssl"
done
`;

  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const result = await ssh.execCommand(`bash -s <<'EOF'\n${script}\nEOF`);
    const domains: ScannedDomain[] = [];
    for (const line of result.stdout.split('\n')) {
      if (!line.startsWith('DOMAIN|')) continue;
      const [, domain, rootPath, ssl] = line.split('|');
      if (domain && domain.includes('.')) {
        domains.push({ domain: domain.trim(), rootPath: rootPath.trim(), sslEnabled: ssl === '1' });
      }
    }
    return domains;
  } finally {
    ssh.dispose();
  }
}

/**
 * Runs multiple commands sequentially on a remote server and returns a combined log.
 */
export async function runRemoteScript(
  opts: SshConnectionOptions,
  commands: string[],
  timeout = 120_000,
): Promise<{ log: string; success: boolean }> {
  const ssh = new NodeSSH();
  const lines: string[] = [];
  try {
    await ssh.connect(buildConnectConfig(opts));

    for (const cmd of commands) {
      lines.push(`$ ${cmd}`);
      const result = await ssh.execCommand(cmd, { execOptions: { pty: false } });
      if (result.stdout) lines.push(result.stdout.trim());
      if (result.stderr) lines.push(`[stderr] ${result.stderr.trim()}`);
      if ((result.code ?? 0) !== 0) {
        lines.push(`[exit ${result.code}]`);
        return { log: lines.join('\n'), success: false };
      }
    }
    return { log: lines.join('\n'), success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lines.push(`[connection error] ${msg}`);
    return { log: lines.join('\n'), success: false };
  } finally {
    ssh.dispose();
  }
}

/**
 * Restarts the remote server OS (fires reboot after 3s so response can be sent).
 */
export async function rebootServer(opts: SshConnectionOptions): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    // Schedule reboot in background so SSH session can close cleanly
    await ssh.execCommand("nohup bash -c 'sleep 3 && reboot' > /dev/null 2>&1 &");
    logger.info({ host: opts.host }, 'Server reboot scheduled');
  } finally {
    ssh.dispose();
  }
}

/**
 * Powers off the remote server OS.
 */
export async function shutdownServer(opts: SshConnectionOptions): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    await ssh.execCommand("nohup bash -c 'sleep 3 && shutdown -h now' > /dev/null 2>&1 &");
    logger.info({ host: opts.host }, 'Server shutdown scheduled');
  } finally {
    ssh.dispose();
  }
}

/**
 * Full stack reinstall: removes all managed containers/configs, then re-provisions.
 */
export async function reinstallStack(opts: SshConnectionOptions): Promise<string> {
  const cleanScript = `
set -e

echo "[1/5] Stopping all Docker containers..."
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

echo "[2/5] Removing CubiqPort nginx configs..."
for f in /etc/nginx/sites-enabled/*; do
  base=$(basename "$f")
  [ "$base" = "default" ] && continue
  rm -f "/etc/nginx/sites-enabled/$base" "/etc/nginx/sites-available/$base"
  echo "  Removed: $base"
done
nginx -t 2>&1 && systemctl reload nginx 2>&1 || true

echo "[3/5] Removing CubiqPort Agent..."
systemctl stop cubiq-agent 2>/dev/null || true
systemctl disable cubiq-agent 2>/dev/null || true
rm -f /etc/systemd/system/cubiq-agent.service
systemctl daemon-reload

echo "[4/5] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "[5/5] Re-provisioning stack (Docker, Nginx, Certbot, Node.js 20)..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
  systemctl enable --now nginx
else
  systemctl start nginx 2>/dev/null || true
fi

if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi

if ! node -e "process.exit(+process.versions.node.split('.')[0] >= 20 ? 0 : 1)" 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "Stack reinstall complete."
`;

  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const result = await ssh.execCommand(`bash -s <<'ENDBASH'\n${cleanScript}\nENDBASH`, {
      execOptions: { pty: false },
    });
    const log = [result.stdout, result.stderr].filter(Boolean).join('\n');
    if ((result.code ?? 0) !== 0) {
      throw new AppError(`Stack reinstall failed:\n${log}`, 500, 'REINSTALL_ERROR');
    }
    logger.info({ host: opts.host }, 'Stack reinstalled successfully');
    return log;
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
    await ssh.connect(buildConnectConfig(opts));

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

// ─── File Management ──────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  type: 'file' | 'dir' | 'link';
  size: number;
  modified: string;
  permissions: string;
}

export async function listDirectory(
  opts: SshConnectionOptions,
  dirPath: string,
): Promise<FileEntry[]> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    // Use stat-friendly ls output
    const res = await ssh.execCommand(
      `ls -la --time-style='+%Y-%m-%dT%H:%M:%S' ${JSON.stringify(dirPath)} 2>&1`,
    );
    if (res.code !== 0) throw new AppError(res.stdout || res.stderr, 400, 'FS_ERROR');
    const entries: FileEntry[] = [];
    for (const line of res.stdout.split('\n')) {
      if (!line || line.startsWith('total')) continue;
      const m = line.match(/^([dlrwx\-]{10})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+)\s+(.+)$/);
      if (!m) continue;
      const [, perms, size, modified, name] = m;
      if (name === '.' || name === '..') continue;
      const cleanName = name.split(' -> ')[0].trim();
      entries.push({
        name: cleanName,
        type: perms[0] === 'd' ? 'dir' : perms[0] === 'l' ? 'link' : 'file',
        size: Number(size),
        modified,
        permissions: perms,
      });
    }
    return entries;
  } finally {
    ssh.dispose();
  }
}

export async function readFileContent(
  opts: SshConnectionOptions,
  filePath: string,
  maxBytes = 512_000,
): Promise<string> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(`head -c ${maxBytes} ${JSON.stringify(filePath)} 2>&1`);
    if (res.code !== 0) throw new AppError(res.stderr || 'Cannot read file', 400, 'FS_ERROR');
    return res.stdout;
  } finally {
    ssh.dispose();
  }
}

export async function writeFileContent(
  opts: SshConnectionOptions,
  filePath: string,
  content: string,
): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    // Use tee to write file safely
    const encoded = Buffer.from(content).toString('base64');
    const res = await ssh.execCommand(
      `echo ${JSON.stringify(encoded)} | base64 -d | tee ${JSON.stringify(filePath)} > /dev/null`,
    );
    if (res.code !== 0) throw new AppError(res.stderr || 'Cannot write file', 400, 'FS_ERROR');
  } finally {
    ssh.dispose();
  }
}

export async function deleteFileOrDir(
  opts: SshConnectionOptions,
  targetPath: string,
  recursive = false,
): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const flag = recursive ? '-rf' : '-f';
    const res = await ssh.execCommand(`rm ${flag} ${JSON.stringify(targetPath)} 2>&1`);
    if (res.code !== 0) throw new AppError(res.stdout || 'Cannot delete', 400, 'FS_ERROR');
  } finally {
    ssh.dispose();
  }
}

export async function makeDirectory(
  opts: SshConnectionOptions,
  dirPath: string,
): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(`mkdir -p ${JSON.stringify(dirPath)} 2>&1`);
    if (res.code !== 0) throw new AppError(res.stdout || 'Cannot create directory', 400, 'FS_ERROR');
  } finally {
    ssh.dispose();
  }
}

// ─── Git Deploy ───────────────────────────────────────────────────────────────

export async function gitDeploy(
  opts: SshConnectionOptions,
  rootPath: string,
  repo: string,
  branch: string,
  deployCommand?: string,
): Promise<string> {
  const buildStep = deployCommand ? `\necho "[deploy] Running build..."\ncd ${JSON.stringify(rootPath)} && ${deployCommand}` : '';
  const script = `
set -e
REPO=${JSON.stringify(repo)}
BRANCH=${JSON.stringify(branch)}
ROOT=${JSON.stringify(rootPath)}

echo "[deploy] Target: $ROOT"

if [ -d "$ROOT/.git" ]; then
  echo "[deploy] Git pull $BRANCH..."
  cd "$ROOT"
  git fetch origin
  git reset --hard origin/$BRANCH
else
  echo "[deploy] Cloning $REPO..."
  git clone --branch $BRANCH $REPO "$ROOT"
fi
${buildStep}
echo "[deploy] Done."
`;

  const ssh = new NodeSSH();
  const lines: string[] = [];
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(`bash -s <<'DEPLOY'\n${script}\nDEPLOY`);
    if (res.stdout) lines.push(res.stdout);
    if (res.stderr) lines.push(`[stderr] ${res.stderr}`);
    if ((res.code ?? 0) !== 0) {
      throw new AppError(`Deploy failed:\n${lines.join('\n')}`, 500, 'DEPLOY_ERROR');
    }
    return lines.join('\n');
  } finally {
    ssh.dispose();
  }
}

// ─── Docker Container Management ─────────────────────────────────────────────

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string; // running | exited | paused | ...
  memUsage: string;
  memPercent: string;
  cpuPercent: string;
  ports: string;
  restartCount: number;
  createdAt: string;
}

export async function listContainersWithStats(
  opts: SshConnectionOptions,
): Promise<ContainerInfo[]> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));

    // Get container list with details
    const listRes = await ssh.execCommand(
      `docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}' 2>/dev/null`,
    );

    if (!listRes.stdout.trim()) return [];

    // Get live stats (no-stream, skip header)
    const statsRes = await ssh.execCommand(
      `docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}|{{.MemPerc}}|{{.CPUPerc}}' 2>/dev/null`,
    );

    // Get restart counts
    const restartRes = await ssh.execCommand(
      `docker inspect --format '{{.Name}}|{{.RestartCount}}|{{.Created}}' $(docker ps -aq 2>/dev/null) 2>/dev/null`,
    );

    // Parse stats into map
    const statsMap: Record<string, { mem: string; memPct: string; cpu: string }> = {};
    for (const line of statsRes.stdout.split('\n').filter(Boolean)) {
      const [name, mem, memPct, cpu] = line.split('|');
      if (name) statsMap[name] = { mem: mem ?? '—', memPct: memPct ?? '—', cpu: cpu ?? '—' };
    }

    // Parse restart counts into map
    const restartMap: Record<string, { count: number; created: string }> = {};
    for (const line of restartRes.stdout.split('\n').filter(Boolean)) {
      const parts = line.replace(/^\//, '').split('|');
      if (parts.length >= 2) {
        restartMap[parts[0]] = { count: Number(parts[1]) || 0, created: parts[2] ?? '' };
      }
    }

    const containers: ContainerInfo[] = [];
    for (const line of listRes.stdout.split('\n').filter(Boolean)) {
      const [id, name, image, status, state, ports] = line.split('|');
      const stats = statsMap[name ?? ''] ?? { mem: '—', memPct: '—', cpu: '—' };
      const meta = restartMap[name ?? ''] ?? { count: 0, created: '' };
      containers.push({
        id: id ?? '',
        name: name ?? '',
        image: image ?? '',
        status: status ?? '',
        state: state ?? '',
        memUsage: stats.mem,
        memPercent: stats.memPct,
        cpuPercent: stats.cpu,
        ports: ports ?? '',
        restartCount: meta.count,
        createdAt: meta.created,
      });
    }
    return containers;
  } finally {
    ssh.dispose();
  }
}

export async function getContainerLogs(
  opts: SshConnectionOptions,
  containerName: string,
  lines = 100,
): Promise<string> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(
      `docker logs --tail=${lines} --timestamps ${JSON.stringify(containerName)} 2>&1`,
    );
    return res.stdout || res.stderr || '(no logs)';
  } finally {
    ssh.dispose();
  }
}

export async function restartContainer(
  opts: SshConnectionOptions,
  containerName: string,
): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(`docker restart ${JSON.stringify(containerName)} 2>&1`);
    if ((res.code ?? 0) !== 0) {
      throw new AppError(`Restart failed: ${res.stderr}`, 500);
    }
  } finally {
    ssh.dispose();
  }
}

export async function stopContainer(
  opts: SshConnectionOptions,
  containerName: string,
): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const res = await ssh.execCommand(`docker stop ${JSON.stringify(containerName)} 2>&1`);
    if ((res.code ?? 0) !== 0) {
      throw new AppError(`Stop failed: ${res.stderr}`, 500);
    }
  } finally {
    ssh.dispose();
  }
}

export async function removeContainer(
  opts: SshConnectionOptions,
  containerName: string,
  force = true,
): Promise<void> {
  const ssh = new NodeSSH();
  try {
    await ssh.connect(buildConnectConfig(opts));
    const flag = force ? '-f' : '';
    const res = await ssh.execCommand(`docker rm ${flag} ${JSON.stringify(containerName)} 2>&1`);
    if ((res.code ?? 0) !== 0) {
      throw new AppError(`Remove failed: ${res.stderr}`, 500);
    }
  } finally {
    ssh.dispose();
  }
}
