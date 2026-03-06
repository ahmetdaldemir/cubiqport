import { NodeSSH } from 'node-ssh';
import { TECH_CATALOG, TechSpec } from '../../services/tech-catalog.js';
import {
  createJob, markRunning, appendLog, finishJob,
  getJob, getServerJobs, InstallJob,
} from '../../services/tech-jobs.js';
import { ServerRepository } from '../servers/server.repository.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { buildSshOptions } from '../../utils/ssh-credentials.js';
import type { TechStatus } from '@cubiqport/shared';

export type { TechStatus };

const repo = new ServerRepository();

export class TechService {

  private async getSshConnection(serverId: string, userId: string): Promise<{ ssh: NodeSSH }> {
    const server = await repo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');

    const opts = buildSshOptions(server);
    const ssh = new NodeSSH();
    await ssh.connect({
      host:     opts.host,
      port:     opts.port,
      username: opts.username,
      ...(opts.password ? { password: opts.password } : { privateKey: opts.privateKey }),
      readyTimeout: 20_000,
    });
    return { ssh };
  }

  /**
   * Tek SSH bağlantısıyla TÜM teknolojileri BATCH halinde tara.
   * Tüm detect + servis komutlarını tek bir büyük script olarak çalıştırır
   * → SSH kanal sınırını (MaxSessions=10) aşmaz, çok daha hızlı.
   */
  async scanTechnologies(serverId: string, userId: string): Promise<TechStatus[]> {
    const { ssh } = await this.getSshConnection(serverId, userId);

    try {
      // Tüm detect komutlarını tek script'e yaz, JSON satırı çıkar
      const scriptLines: string[] = [
        'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:$PATH',
        'export NVM_DIR="$HOME/.nvm"',
        '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null || true',
        '',
      ];

      for (const spec of TECH_CATALOG) {
        // Her teknoloji için: VER=<detect> && echo "id|ver"
        scriptLines.push(`__VER_${spec.id}=$(${spec.detectCmd} 2>/dev/null | head -1 | tr -d '\\r\\n' | xargs)`);

        // Servis durumu
        if (spec.serviceNames?.length) {
          const checks = spec.serviceNames
            .map(s => `systemctl is-active ${s} 2>/dev/null`)
            .join(' || ');
          scriptLines.push(
            `__SVC_${spec.id}=$(( ${checks} ) | head -1 | tr -d '\\r\\n' | xargs || echo "inactive")`,
          );
        } else {
          scriptLines.push(`__SVC_${spec.id}=""`);
        }

        scriptLines.push(
          `echo "__TECH__|${spec.id}|$__VER_${spec.id}|$__SVC_${spec.id}"`,
        );
      }

      const script = scriptLines.join('\n');
      const result = await ssh.execCommand(`bash << 'SCAN_EOF'\n${script}\nSCAN_EOF`);

      // Çıktıyı parse et
      const versionMap: Record<string, { version: string; svcStatus: string }> = {};
      for (const line of (result.stdout + result.stderr).split('\n')) {
        if (!line.startsWith('__TECH__|')) continue;
        const parts = line.split('|');
        if (parts.length >= 3) {
          versionMap[parts[1]] = {
            version: parts[2]?.trim() ?? '',
            svcStatus: parts[3]?.trim() ?? '',
          };
        }
      }

      return TECH_CATALOG.map(spec => {
        const data = versionMap[spec.id];
        const version = data?.version || undefined;
        const svcRaw = data?.svcStatus ?? '';

        let serviceStatus: TechStatus['serviceStatus'];
        if (!spec.serviceNames?.length) {
          serviceStatus = version ? 'running' : 'unknown';
        } else if (svcRaw === 'active') {
          serviceStatus = 'running';
        } else if (svcRaw === 'inactive' || svcRaw === 'failed') {
          serviceStatus = 'stopped';
        } else {
          serviceStatus = version ? 'stopped' : 'unknown';
        }

        return {
          id: spec.id, name: spec.name, description: spec.description,
          category: spec.category, icon: spec.icon,
          installed: !!version, version, serviceStatus,
          versions: spec.versions, defaultVersion: spec.defaultVersion,
        };
      });

    } finally {
      ssh.dispose();
    }
  }

  /** Kurulum/güncelleme başlat — jobId döner, arka planda çalışır */
  async startInstall(
    serverId: string,
    techId: string,
    version: string | undefined,
    userId: string,
    action: 'install' | 'upgrade' = 'install',
  ): Promise<string> {
    const spec = TECH_CATALOG.find(t => t.id === techId);
    if (!spec) throw new AppError(`Teknoloji bulunamadı: ${techId}`, 400);

    const job = createJob({ serverId, techId, techName: spec.name, version, action });

    // Arka planda çalıştır
    this.runInstall(job.id, serverId, spec, version, userId).catch(err => {
      logger.error({ err, jobId: job.id }, 'Install job failed');
      appendLog(job.id, `\n✗ Beklenmeyen hata: ${err instanceof Error ? err.message : String(err)}\n`);
      finishJob(job.id, 'failed');
    });

    return job.id;
  }

  private async runInstall(
    jobId: string,
    serverId: string,
    spec: TechSpec,
    version: string | undefined,
    userId: string,
  ): Promise<void> {
    markRunning(jobId);
    appendLog(jobId, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    appendLog(jobId, ` ${spec.icon}  ${spec.name}${version ? ` v${version}` : ''} kurulumu\n`);
    appendLog(jobId, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);

    const { ssh } = await this.getSshConnection(serverId, userId);
    try {
      const script = spec.installScript(version);
      const result = await ssh.execCommand(`bash -c ${JSON.stringify(script)}`, {
        execOptions: { pty: true },
        onStdout: chunk => appendLog(jobId, chunk.toString()),
        onStderr:  chunk => appendLog(jobId, chunk.toString()),
      });

      if (result.code === 0) {
        appendLog(jobId, `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        appendLog(jobId, ` ✓  ${spec.name} başarıyla kuruldu!\n`);
        appendLog(jobId, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        finishJob(jobId, 'success', result.code ?? 0);
      } else {
        appendLog(jobId, `\n✗ Kurulum başarısız (exit: ${result.code})\n`);
        finishJob(jobId, 'failed', result.code ?? 1);
      }
    } catch (err) {
      appendLog(jobId, `\n✗ SSH hatası: ${err instanceof Error ? err.message : String(err)}\n`);
      finishJob(jobId, 'failed');
    } finally {
      ssh.dispose();
    }
  }

  /** Servis başlat / durdur / yeniden başlat */
  async controlService(
    serverId: string,
    techId: string,
    action: 'start' | 'stop' | 'restart',
    userId: string,
  ): Promise<string> {
    const spec = TECH_CATALOG.find(t => t.id === techId);
    if (!spec || !spec.serviceNames?.length) throw new AppError('Servis yönetimi desteklenmiyor', 400);

    const job = createJob({ serverId, techId, techName: spec.name, action: 'service' });
    markRunning(job.id);

    const { ssh } = await this.getSshConnection(serverId, userId);
    const svc = spec.serviceNames[0];
    const cmd = `systemctl ${action} ${svc} && systemctl is-active ${svc}`;
    appendLog(job.id, `→ systemctl ${action} ${svc}...\n`);

    try {
      const result = await ssh.execCommand(cmd, {
        onStdout: c => appendLog(job.id, c.toString()),
        onStderr:  c => appendLog(job.id, c.toString()),
      });
      ssh.dispose();

      if (result.code === 0) {
        appendLog(job.id, `✓ ${svc} ${action} işlemi başarılı\n`);
        finishJob(job.id, 'success', 0);
      } else {
        appendLog(job.id, `✗ ${svc} ${action} başarısız (exit: ${result.code})\n`);
        finishJob(job.id, 'failed', result.code ?? 1);
      }
    } catch (err) {
      ssh.dispose();
      appendLog(job.id, `✗ ${err instanceof Error ? err.message : String(err)}\n`);
      finishJob(job.id, 'failed');
    }

    return job.id;
  }

  getJob(jobId: string): InstallJob | undefined { return getJob(jobId); }
  getServerJobs(serverId: string): InstallJob[] { return getServerJobs(serverId); }
}
