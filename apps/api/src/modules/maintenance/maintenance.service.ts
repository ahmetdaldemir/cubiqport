import { NodeSSH } from 'node-ssh';
import { ServerRepository } from '../servers/server.repository.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { buildConnectConfig } from '../../services/ssh.service.js';
import { buildSshOptions } from '../../utils/ssh-credentials.js';
import { logger } from '../../utils/logger.js';
import {
  createJob, markRunning, appendLog, finishJob,
  getJob, getServerJobs, InstallJob,
} from '../../services/tech-jobs.js';

export type { InstallJob };

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface LogFile {
  path: string;
  size: number;
  sizeHuman: string;
  modified: string;
}

export interface DockerItem {
  id: string;
  name: string;
  image?: string;
  status?: string;
  sizeHuman?: string;
  type: 'container' | 'volume' | 'image';
}

export interface LargeFile {
  path: string;
  size: number;
  sizeHuman: string;
  modified: string;
  isDir: boolean;
}

export interface DiskUsage {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  usePct: string;
  mountpoint: string;
}

export interface SystemOverview {
  diskUsage: DiskUsage[];
  logsDirSize: string;
  dockerDirSize: string;
  tmpDirSize: string;
}

// ─── Database image patterns — bu container/volume'ler silinmez ──────────────
const DB_IMAGE_PATTERNS = [
  'postgres', 'postgresql', 'mysql', 'mariadb', 'mongo', 'mongodb',
  'redis', 'elasticsearch', 'cassandra', 'cockroachdb', 'mssql', 'oracle',
];

function isDbImage(image: string): boolean {
  const lower = image.toLowerCase();
  return DB_IMAGE_PATTERNS.some(p => lower.includes(p));
}

const repo = new ServerRepository();

// ─── SSH bağlantı yardımcısı ──────────────────────────────────────────────────
async function connectSsh(serverId: string, userId: string) {
  const server = await repo.findById(serverId, userId);
  if (!server) throw new NotFoundError('Server');
  const ssh = new NodeSSH();
  await ssh.connect({ ...buildConnectConfig(buildSshOptions(server)), readyTimeout: 20_000 });
  return ssh;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class MaintenanceService {

  getJob(jobId: string) { return getJob(jobId); }
  getServerJobs(serverId: string) { return getServerJobs(serverId); }

  // ── Sistem genel bakışı ─────────────────────────────────────────────────────
  async getOverview(serverId: string, userId: string): Promise<SystemOverview> {
    const ssh = await connectSsh(serverId, userId);
    try {
      const script = `
df -h --output=source,size,used,avail,pcent,target 2>/dev/null | tail -n +2 | grep -v tmpfs | head -20 | awk '{print $1"|"$2"|"$3"|"$4"|"$5"|"$6}'
echo "---LOGS---"
du -sh /var/log 2>/dev/null | cut -f1 || echo "?"
echo "---DOCKER---"
du -sh /var/lib/docker 2>/dev/null | cut -f1 || echo "?"
echo "---TMP---"
du -sh /tmp 2>/dev/null | cut -f1 || echo "?"
`.trim();
      const result = await ssh.execCommand(`bash -c '${script.replace(/'/g, "'\\''")}'`);
      return parseOverview(result.stdout);
    } finally {
      ssh.dispose();
    }
  }

  // ── Log analizi ─────────────────────────────────────────────────────────────
  async analyzeLogs(serverId: string, userId: string): Promise<LogFile[]> {
    const ssh = await connectSsh(serverId, userId);
    try {
      const cmd = `find /var/log -type f \\( -name "*.log" -o -name "*.log.*" -o -name "*.gz" \\) -size +1M 2>/dev/null | xargs ls -lh --time-style=+"%Y-%m-%d" 2>/dev/null | awk '{print $5"|"$6"|"$9}' | sort -t"|" -k1 -hr | head -50`;
      const result = await ssh.execCommand(cmd);
      return parseLogFiles(result.stdout);
    } finally {
      ssh.dispose();
    }
  }

  // ── Docker analizi ──────────────────────────────────────────────────────────
  async analyzeDocker(serverId: string, userId: string): Promise<{
    containers: DockerItem[];
    volumes: DockerItem[];
    images: DockerItem[];
    available: boolean;
  }> {
    const ssh = await connectSsh(serverId, userId);
    try {
      // Docker kurulu mu?
      const check = await ssh.execCommand('command -v docker >/dev/null 2>&1 && echo yes || echo no');
      if (check.stdout.trim() !== 'yes') {
        return { containers: [], volumes: [], images: [], available: false };
      }

      const script = `
echo "===CONTAINERS==="
docker ps -a --filter "status=exited" --filter "status=created" --filter "status=dead" --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}" 2>/dev/null
echo "===VOLUMES==="
docker volume ls -q --filter "dangling=true" 2>/dev/null
echo "===IMAGES==="
docker images -f "dangling=false" --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}" 2>/dev/null | head -30
echo "===END==="
`.trim();
      const result = await ssh.execCommand(`bash -c "${script.replace(/"/g, '\\"')}"`);
      const parsed = parseDockerInfo(result.stdout);

      // Veritabanı imajı içeren container'ları filtrele
      parsed.containers = parsed.containers.filter(c => !isDbImage(c.image ?? ''));
      parsed.images = parsed.images.filter(i => !isDbImage(i.image ?? ''));

      return { ...parsed, available: true };
    } finally {
      ssh.dispose();
    }
  }

  // ── Büyük dosya analizi ─────────────────────────────────────────────────────
  async analyzeLargeFiles(
    serverId: string,
    userId: string,
    minSizeMB = 100,
  ): Promise<LargeFile[]> {
    const ssh = await connectSsh(serverId, userId);
    try {
      const cmd = `find / \\( -path /proc -o -path /sys -o -path /dev -o -path /run \\) -prune -o \\( -type f -o -type d \\) -size +${minSizeMB}M -print0 2>/dev/null | xargs -0 ls -lhd --time-style=+"%Y-%m-%d" 2>/dev/null | awk '{print $1"|"$5"|"$6"|"$9}' | sort -t"|" -k2 -hr | head -60`;
      const result = await ssh.execCommand(cmd);
      return parseLargeFiles(result.stdout);
    } finally {
      ssh.dispose();
    }
  }

  // ── Log temizleme (streaming) ───────────────────────────────────────────────
  async cleanLogs(serverId: string, userId: string): Promise<string> {
    const job = createJob({
      serverId,
      techId: 'log-cleanup',
      techName: 'Log Temizleme',
      action: 'service',
    });

    this.runSshJob(job.id, serverId, userId, async (ssh, log) => {
      log('Büyük log dosyaları temizleniyor...');

      // Journal log boyutunu kısıt
      const journal = await ssh.execCommand('journalctl --vacuum-size=100M --vacuum-time=7d 2>&1 || echo "journalctl mevcut değil"');
      log(journal.stdout || journal.stderr || '');

      // Rotated log dosyalarını sil
      const rotated = await ssh.execCommand('find /var/log -type f \\( -name "*.gz" -o -name "*.old" -o -name "*.bak" \\) -delete -print 2>/dev/null | wc -l');
      log(`Rotated log temizlendi: ${rotated.stdout.trim()} dosya`);

      // 30 günden eski büyük log dosyalarını truncate et (sil değil, boyutu sıfırla)
      const truncated = await ssh.execCommand(`find /var/log -type f -name "*.log" -size +50M -mtime +7 -exec sh -c 'echo "" > "$1" && echo "Temizlendi: $1"' _ {} \\; 2>/dev/null`);
      if (truncated.stdout) log(truncated.stdout);

      // apt cache temizle
      const apt = await ssh.execCommand('apt-get clean 2>/dev/null && echo "APT cache temizlendi" || echo "APT mevcut değil"');
      log(apt.stdout.trim());

      log('\n✓ Log temizleme tamamlandı');
    }).catch(err => logger.error({ err, jobId: job.id }, 'Log cleanup failed'));

    return job.id;
  }

  // ── Docker temizleme (streaming) ────────────────────────────────────────────
  async cleanDocker(
    serverId: string,
    userId: string,
    options: { containers?: string[]; volumes?: string[]; images?: string[]; pruneAll?: boolean },
  ): Promise<string> {
    const job = createJob({
      serverId,
      techId: 'docker-cleanup',
      techName: 'Docker Temizleme',
      action: 'service',
    });

    this.runSshJob(job.id, serverId, userId, async (ssh, log) => {
      log('Docker temizleme başlatılıyor...\n');

      if (options.containers?.length) {
        log(`→ ${options.containers.length} container siliniyor...`);
        const r = await ssh.execCommand(`docker rm ${options.containers.join(' ')} 2>&1`);
        log(r.stdout || r.stderr || '');
      }

      if (options.volumes?.length) {
        log(`\n→ ${options.volumes.length} volume siliniyor...`);
        const r = await ssh.execCommand(`docker volume rm ${options.volumes.join(' ')} 2>&1`);
        log(r.stdout || r.stderr || '');
      }

      if (options.images?.length) {
        log(`\n→ ${options.images.length} image siliniyor...`);
        const r = await ssh.execCommand(`docker rmi ${options.images.join(' ')} 2>&1`);
        log(r.stdout || r.stderr || '');
      }

      if (options.pruneAll) {
        log('\n→ Kullanılmayan tüm kaynaklar temizleniyor (prune)...');
        const r = await ssh.execCommand('docker system prune -f 2>&1');
        log(r.stdout || r.stderr || '');
      }

      log('\n✓ Docker temizleme tamamlandı');
    }).catch(err => logger.error({ err, jobId: job.id }, 'Docker cleanup failed'));

    return job.id;
  }

  // ── Dosya silme (streaming) ─────────────────────────────────────────────────
  async deleteFiles(serverId: string, userId: string, paths: string[]): Promise<string> {
    if (!paths.length) throw new AppError('Silinecek dosya seçilmedi', 400);

    const job = createJob({
      serverId,
      techId: 'file-delete',
      techName: 'Dosya Silme',
      action: 'service',
    });

    this.runSshJob(job.id, serverId, userId, async (ssh, log) => {
      log(`${paths.length} dosya/dizin siliniyor...\n`);
      for (const p of paths) {
        // Güvenlik: kritik sistem dizinlerini koru
        if (isCriticalPath(p)) {
          log(`⚠ Atlandı (korumalı yol): ${p}`);
          continue;
        }
        const r = await ssh.execCommand(`rm -rf "${p.replace(/"/g, '')}" 2>&1 && echo "Silindi: ${p}" || echo "Hata: ${p}"`);
        log(r.stdout || r.stderr || '');
      }
      log('\n✓ Dosya silme tamamlandı');
    }).catch(err => logger.error({ err, jobId: job.id }, 'File delete failed'));

    return job.id;
  }

  // ── Zararlı yazılım taraması (streaming) ────────────────────────────────────
  async runMalwareScan(serverId: string, userId: string): Promise<string> {
    const job = createJob({
      serverId,
      techId: 'malware-scan',
      techName: 'Zararlı Yazılım Taraması',
      action: 'service',
    });

    this.runSshJob(job.id, serverId, userId, async (ssh, log) => {
      log('Sistem güvenlik taraması başlatılıyor...\n');
      log('━'.repeat(50));

      // 1. Şüpheli SUID/SGID dosyaları
      log('\n[1/5] SUID/SGID dosyaları kontrol ediliyor...');
      const suid = await ssh.execCommand(
        `find / \\( -path /proc -o -path /sys \\) -prune -o -type f \\( -perm -4000 -o -perm -2000 \\) -print 2>/dev/null | head -30`,
      );
      if (suid.stdout.trim()) {
        log('Bulunan SUID/SGID dosyaları:\n' + suid.stdout);
      } else {
        log('✓ Standart dışı SUID/SGID dosyası bulunamadı');
      }

      // 2. /tmp ve /dev/shm'deki çalıştırılabilir dosyalar
      log('\n[2/5] /tmp ve geçici dizinlerdeki şüpheli dosyalar...');
      const tmpExec = await ssh.execCommand(
        `find /tmp /dev/shm /var/tmp -type f -executable 2>/dev/null`,
      );
      if (tmpExec.stdout.trim()) {
        log('⚠ Şüpheli çalıştırılabilir dosyalar:\n' + tmpExec.stdout);
      } else {
        log('✓ Geçici dizinlerde çalıştırılabilir dosya yok');
      }

      // 3. Crontab kontrolü (root ve tüm kullanıcılar)
      log('\n[3/5] Crontab ve zamanlanmış görevler...');
      const cron = await ssh.execCommand(
        `crontab -l 2>/dev/null; ls -la /etc/cron* /var/spool/cron 2>/dev/null`,
      );
      log(cron.stdout || '(crontab boş)');

      // 4. Açık port ve şüpheli ağ bağlantıları
      log('\n[4/5] Aktif ağ bağlantıları ve açık portlar...');
      const netstat = await ssh.execCommand(
        `ss -tunapw 2>/dev/null | head -40 || netstat -tunapw 2>/dev/null | head -40`,
      );
      log(netstat.stdout || '');

      // 5. rkhunter veya chkrootkit (varsa)
      log('\n[5/5] Rootkit tarayıcı...');
      const rkCheck = await ssh.execCommand('command -v rkhunter >/dev/null 2>&1 && echo rkhunter || command -v chkrootkit >/dev/null 2>&1 && echo chkrootkit || echo none');
      const tool = rkCheck.stdout.trim();

      if (tool === 'rkhunter') {
        log('rkhunter bulundu, tarama çalıştırılıyor...');
        const rk = await ssh.execCommand('rkhunter --check --sk --nocolors 2>&1 | tail -50', {
          execOptions: { pty: false },
        });
        log(rk.stdout || rk.stderr || '');
      } else if (tool === 'chkrootkit') {
        log('chkrootkit bulundu, tarama çalıştırılıyor...');
        const ck = await ssh.execCommand('chkrootkit 2>&1 | grep -v "not found" | tail -30');
        log(ck.stdout || ck.stderr || '');
      } else {
        log('ℹ Rootkit tarayıcı bulunamadı (rkhunter veya chkrootkit kurulu değil)');
        log('  Kurmak için: apt-get install -y rkhunter');

        // ClamAV kontrolü
        const clam = await ssh.execCommand('command -v clamscan >/dev/null 2>&1 && echo yes || echo no');
        if (clam.stdout.trim() === 'yes') {
          log('\nclamd bulundu, kritik dizinler taranıyor...');
          const scan = await ssh.execCommand('clamscan -r --no-summary /tmp /var/www 2>&1 | grep -v "OK$" | head -30', {
            execOptions: { pty: false },
          });
          log(scan.stdout || 'Tehdit bulunamadı');
        }
      }

      // Genel şüpheli process kontrolü
      log('\n━'.repeat(50));
      log('\n[BONUS] Yüksek CPU/MEM kullanan şüpheli processler:');
      const ps = await ssh.execCommand('ps aux --sort=-%cpu | head -15 2>/dev/null || ps aux | head -15');
      log(ps.stdout || '');

      log('\n━'.repeat(50));
      log('✓ Güvenlik taraması tamamlandı');
    }).catch(err => logger.error({ err, jobId: job.id }, 'Malware scan failed'));

    return job.id;
  }

  // ── SSE stream endpoint (tech-jobs ile uyumlu) ──────────────────────────────
  streamJobLogs(jobId: string) {
    return getJob(jobId);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async runSshJob(
    jobId: string,
    serverId: string,
    userId: string,
    fn: (ssh: NodeSSH, log: (line: string) => void) => Promise<void>,
  ) {
    markRunning(jobId);
    let ssh: NodeSSH | null = null;
    try {
      ssh = await connectSsh(serverId, userId);
      const log = (line: string) => appendLog(jobId, line);
      await fn(ssh, log);
      finishJob(jobId, 'success', 0);
    } catch (err) {
      appendLog(jobId, `\n✗ Hata: ${err instanceof Error ? err.message : String(err)}`);
      finishJob(jobId, 'failed', 1);
      throw err;
    } finally {
      ssh?.dispose();
    }
  }
}

// ─── Kritik sistem yolları koruma listesi ─────────────────────────────────────
const CRITICAL_PATHS = [
  '/', '/bin', '/sbin', '/usr', '/lib', '/lib64', '/etc',
  '/boot', '/proc', '/sys', '/dev', '/run',
  '/var/lib/dpkg', '/var/lib/apt', '/var/lib/docker',
];

function isCriticalPath(p: string): boolean {
  const normalized = p.replace(/\/+$/, '');
  return CRITICAL_PATHS.some(cp => normalized === cp || normalized.startsWith(cp + '/') === false && cp === normalized);
}

// ─── Ayrıştırıcılar ──────────────────────────────────────────────────────────

function parseOverview(raw: string): SystemOverview {
  const lines = raw.split('\n');
  const diskUsage: DiskUsage[] = [];
  let logsDirSize = '?', dockerDirSize = '?', tmpDirSize = '?';
  let section: 'disk' | 'logs' | 'docker' | 'tmp' = 'disk';

  for (const line of lines) {
    if (line === '---LOGS---') { section = 'logs'; continue; }
    if (line === '---DOCKER---') { section = 'docker'; continue; }
    if (line === '---TMP---') { section = 'tmp'; continue; }

    const t = line.trim();
    if (!t) continue;

    if (section === 'disk') {
      const parts = t.split('|');
      if (parts.length === 6) {
        diskUsage.push({
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usePct: parts[4],
          mountpoint: parts[5],
        });
      }
    } else if (section === 'logs') {
      logsDirSize = t;
    } else if (section === 'docker') {
      dockerDirSize = t;
    } else if (section === 'tmp') {
      tmpDirSize = t;
    }
  }

  return { diskUsage, logsDirSize, dockerDirSize, tmpDirSize };
}

function parseLogFiles(raw: string): LogFile[] {
  const files: LogFile[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split('|');
    if (parts.length < 3) continue;
    const [sizeHuman, modified, path] = parts;
    files.push({
      path,
      size: parseHumanSize(sizeHuman),
      sizeHuman,
      modified,
    });
  }
  return files;
}

function parseDockerInfo(raw: string): { containers: DockerItem[]; volumes: DockerItem[]; images: DockerItem[] } {
  const containers: DockerItem[] = [];
  const volumes: DockerItem[] = [];
  const images: DockerItem[] = [];
  let section: 'containers' | 'volumes' | 'images' | null = null;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t === '===CONTAINERS===') { section = 'containers'; continue; }
    if (t === '===VOLUMES===') { section = 'volumes'; continue; }
    if (t === '===IMAGES===') { section = 'images'; continue; }
    if (t === '===END===') break;
    if (!t || !section) continue;

    if (section === 'containers') {
      const parts = t.split('|');
      if (parts.length >= 3) {
        containers.push({ id: parts[0], name: parts[1], image: parts[2], status: parts[3] ?? '', type: 'container' });
      }
    } else if (section === 'volumes') {
      volumes.push({ id: t, name: t, type: 'volume' });
    } else if (section === 'images') {
      const parts = t.split('|');
      if (parts.length >= 4) {
        const repo = parts[1] === '<none>' ? parts[0] : `${parts[1]}:${parts[2]}`;
        images.push({ id: parts[0], name: repo, image: parts[1], sizeHuman: parts[3], type: 'image' });
      }
    }
  }

  return { containers, volumes, images };
}

function parseLargeFiles(raw: string): LargeFile[] {
  const files: LargeFile[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split('|');
    if (parts.length < 4) continue;
    const [perms, sizeHuman, modified, path] = parts;
    files.push({
      path,
      size: parseHumanSize(sizeHuman),
      sizeHuman,
      modified,
      isDir: perms.startsWith('d'),
    });
  }
  return files;
}

function parseHumanSize(s: string): number {
  const m = s.match(/^([\d.]+)([KMGT]?)$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  const map: Record<string, number> = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
  return Math.round(n * (map[unit] ?? 1));
}
