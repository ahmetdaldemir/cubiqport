import os from 'os';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { eq, gte, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { metrics, servers } from '../../db/schema.js';
import { setJson, getJson, metricsKey } from '../../redis/index.js';
import { ServerRepository } from '../servers/server.repository.js';
import { AgentService } from '../../services/agent.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { METRICS_TTL_SECONDS } from '@cubiqport/shared';
import type { LiveMetrics, ContainerInfo } from '@cubiqport/shared';
import { runRemoteCommand } from '../../services/ssh.service.js';
import { decrypt } from '../../utils/encrypt.js';
import type { Server } from '../../db/schema.js';

const serverRepo = new ServerRepository();
const agentService = new AgentService();

// ─── Local OS metric collection (no agent needed) ─────────────────────────────

function collectLocalMetrics(): LiveMetrics {
  // ── CPU (load-average based, instant response) ────────────────────────────
  const loadAvg = os.loadavg()[0];
  const cpuCount = Math.max(1, os.cpus().length);
  const cpuUsage = Math.min(100, Math.round((loadAvg / cpuCount) * 100));

  // ── RAM ──────────────────────────────────────────────────────────────────
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

  // ── Disk ─────────────────────────────────────────────────────────────────
  let diskUsage = 0;
  try {
    const dfOut = execSync("df / --output=pcent 2>/dev/null | tail -1", {
      timeout: 2000,
      encoding: 'utf8',
    }).trim().replace('%', '');
    diskUsage = parseInt(dfOut, 10) || 0;
  } catch {
    try {
      const dfOut = execSync("df / | awk 'NR==2{print $5}'", {
        timeout: 2000,
        encoding: 'utf8',
      }).trim().replace('%', '');
      diskUsage = parseInt(dfOut, 10) || 0;
    } catch { /* ignore */ }
  }

  // ── Network (cumulative bytes from /proc/net/dev) ──────────────────────
  let networkRx = 0;
  let networkTx = 0;
  try {
    const netDev = readFileSync('/proc/net/dev', 'utf8');
    for (const line of netDev.split('\n').slice(2)) {
      const parts = line.trim().split(/\s+/);
      if (!parts[0] || parts[0].startsWith('lo:')) continue;
      const rx = parseInt(parts[1] ?? '0', 10);
      const tx = parseInt(parts[9] ?? '0', 10);
      networkRx += isNaN(rx) ? 0 : rx;
      networkTx += isNaN(tx) ? 0 : tx;
    }
    networkRx = Math.round(networkRx / 1024);
    networkTx = Math.round(networkTx / 1024);
  } catch { /* not Linux */ }

  // ── Docker containers ─────────────────────────────────────────────────────
  const containers: ContainerInfo[] = [];
  try {
    const dockerOut = execSync(
      "docker ps --format '{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}'",
      { timeout: 3000, encoding: 'utf8' },
    ).trim();
    if (dockerOut) {
      for (const line of dockerOut.split('\n').filter(Boolean)) {
        const [id = '', name = '', image = '', ...statusParts] = line.split('\t');
        containers.push({
          id: id.substring(0, 12),
          name,
          image,
          status: statusParts.join(' '),
          ports: [],
        });
      }
    }
  } catch { /* docker not installed or no containers */ }

  return {
    cpuUsage,
    ramUsage,
    diskUsage,
    networkUsage: { rx: networkRx, tx: networkTx },
    containers,
    uptime: Math.floor(os.uptime()),
    timestamp: new Date().toISOString(),
  };
}

// ─── SSH-based remote metrics (fallback when agent is not installed) ──────────

const SSH_METRICS_SCRIPT = `python3 -c "
import os,json,subprocess,datetime
try:
    cpu_raw=open('/proc/loadavg').read().split()[0]
    cores=len([l for l in open('/proc/cpuinfo') if l.startswith('processor')])
    cpu_pct=min(100,round(float(cpu_raw)/max(1,cores)*100))
except: cpu_pct=0
try:
    mem={}
    [mem.__setitem__(l.split(':')[0].strip(),int(l.split(':')[1].strip().split()[0])) for l in open('/proc/meminfo')]
    tot=mem.get('MemTotal',1); avail=mem.get('MemAvailable',mem.get('MemFree',0))
    ram_pct=round((tot-avail)/tot*100)
except: ram_pct=0
try:
    import shutil; d=shutil.disk_usage('/'); disk_pct=round(d.used/d.total*100)
except: disk_pct=0
rx=tx=0
try:
    for l in open('/proc/net/dev').readlines()[2:]:
        p=l.strip().split()
        if p[0].startswith('lo:'): continue
        rx+=int(p[1]); tx+=int(p[9])
    rx=rx//1024; tx=tx//1024
except: pass
containers=[]
try:
    r=subprocess.run(['docker','ps','--format','{{.Names}}|{{.Image}}|{{.Status}}'],capture_output=True,text=True,timeout=5)
    for line in r.stdout.strip().split('\\\\n'):
        if '|' in line:
            p=line.split('|'); containers.append({'id':'','name':p[0],'image':p[1],'status':p[2],'ports':[]})
except: pass
try: uptime=int(float(open('/proc/uptime').read().split()[0]))
except: uptime=0
print(json.dumps({'cpuUsage':cpu_pct,'ramUsage':ram_pct,'diskUsage':disk_pct,'networkUsage':{'rx':rx,'tx':tx},'containers':containers,'uptime':uptime,'timestamp':datetime.datetime.utcnow().isoformat()+'Z'}))
" 2>/dev/null`;

async function collectSshMetrics(server: Server): Promise<LiveMetrics | null> {
  try {
    const opts =
      server.sshAuthType === 'password' && server.sshPassword
        ? { host: server.ip, port: server.sshPort, username: server.sshUser, password: decrypt(server.sshPassword) }
        : { host: server.ip, port: server.sshPort, username: server.sshUser, privateKey: decrypt(server.sshKey ?? '') };

    const result = await runRemoteCommand(opts, SSH_METRICS_SCRIPT);
    const out = result.stdout.trim();
    if (!out) return null;
    return JSON.parse(out) as LiveMetrics;
  } catch (err) {
    logger.warn({ err, serverId: server.id }, 'SSH metrics collection failed');
    return null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class MonitoringService {
  /**
   * Fetch live metrics from Redis cache; falls back to:
   * 1. Remote agent poll (if agent port reachable)
   * 2. Local OS collection (if server IP is localhost)
   * Never throws — always returns data or null.
   */
  async getLiveMetrics(serverId: string, userId: string): Promise<LiveMetrics | null> {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');

    // ── 1. Redis cache ─────────────────────────────────────────────────────
    const cached = await getJson<LiveMetrics>(metricsKey(serverId));
    if (cached) return cached;

    const isLocalServer =
      server.ip === '127.0.0.1' ||
      server.ip === 'localhost' ||
      server.ip === '144.91.65.111';

    // ── 2. Try remote agent ────────────────────────────────────────────────
    try {
      const live = await agentService.getMetrics(server.ip);
      await setJson(metricsKey(serverId), live, METRICS_TTL_SECONDS);
      return live;
    } catch { /* Agent not running */ }

    // ── 3. Local OS collection for self-hosted server ──────────────────────
    if (isLocalServer) {
      try {
        const live = collectLocalMetrics();
        await setJson(metricsKey(serverId), live, METRICS_TTL_SECONDS);
        return live;
      } catch (err) {
        logger.warn({ err }, 'Local OS metric collection failed');
      }
    }

    // ── 4. SSH-based fallback for remote servers ───────────────────────────
    if (!isLocalServer && server.status === 'active') {
      const live = await collectSshMetrics(server);
      if (live) {
        await setJson(metricsKey(serverId), live, METRICS_TTL_SECONDS);
        return live;
      }
    }

    return null;
  }

  /**
   * Store a metrics snapshot pushed by the agent or internal poller.
   */
  async storeMetrics(serverId: string, data: LiveMetrics): Promise<void> {
    await setJson(metricsKey(serverId), data, METRICS_TTL_SECONDS);

    await db.insert(metrics).values({
      serverId,
      cpuUsage: data.cpuUsage,
      ramUsage: data.ramUsage,
      diskUsage: data.diskUsage,
      networkUsage: data.networkUsage,
      timestamp: new Date(data.timestamp),
    });
  }

  /**
   * Historical metrics for a server (last N hours).
   */
  async getHistoricalMetrics(serverId: string, userId: string, hours = 24) {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db.query.metrics.findMany({
      where: and(eq(metrics.serverId, serverId), gte(metrics.timestamp, since)),
      orderBy: (m, { asc }) => [asc(m.timestamp)],
      limit: 1440,
    });
  }

  /**
   * Poller: collect and store metrics for all active servers.
   */
  async pollAllServers(): Promise<void> {
    const activeServers = await db.query.servers.findMany({
      where: eq(servers.status, 'active'),
    });

    await Promise.allSettled(
      activeServers.map(async (server) => {
        try {
          const isLocal =
            server.ip === '127.0.0.1' ||
            server.ip === 'localhost' ||
            server.ip === '144.91.65.111';

          let live: LiveMetrics | null = null;
          try {
            live = await agentService.getMetrics(server.ip);
          } catch {
            if (isLocal) {
              live = collectLocalMetrics();
            } else {
              // SSH fallback for remote servers
              live = await collectSshMetrics(server);
            }
          }

          if (live) await this.storeMetrics(server.id, live);
        } catch (err) {
          logger.warn({ err, serverId: server.id }, 'Failed to poll metrics');
        }
      }),
    );
  }
}
