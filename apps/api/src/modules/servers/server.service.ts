import { ServerRepository } from './server.repository.js';
import {
  testSshConnection,
  installAgent,
  rebootServer,
  shutdownServer,
  reinstallStack,
  scanNginxDomains,
  scanServer,
  listContainersWithStats,
  getContainerLogs,
  restartContainer,
  stopContainer,
  removeContainer,
  type SshConnectionOptions,
} from '../../services/ssh.service.js';
import { AgentService } from '../../services/agent.service.js';
import { DomainRepository } from '../domains/domain.repository.js';
import { encrypt } from '../../utils/encrypt.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { buildSshOptions } from '../../utils/ssh-credentials.js';
import type { CreateServerInput, UpdateServerInput } from '@cubiqport/shared';

const domainRepo = new DomainRepository();

const repo = new ServerRepository();
const agentService = new AgentService();

export class ServerService {
  async listServers(userId: string) {
    const servers = await repo.findAll(userId);
    const ids = servers.map((s) => s.id);
    const domainCounts = await domainRepo.countByServerIds(ids);
    return servers.map(({ sshKey: _, ...s }) => ({
      ...s,
      domainCount: domainCounts.get(s.id) ?? 0,
    }));
  }

  async getServer(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const { sshKey: _, ...rest } = server;
    return rest;
  }

  async createServer(userId: string, input: CreateServerInput) {
    const authType = input.sshAuthType ?? 'password';
    const server = await repo.create({
      userId,
      name: input.name,
      ip: input.ip,
      sshPort: input.sshPort,
      sshUser: input.sshUser,
      sshAuthType: authType,
      sshKey: input.sshKey ? encrypt(input.sshKey) : null,
      sshPassword: input.sshPassword ? encrypt(input.sshPassword) : null,
      status: 'pending',
    });

    const opts: SshConnectionOptions = {
      host: server.ip,
      port: server.sshPort,
      username: server.sshUser,
      ...(authType === 'password'
        ? { password: input.sshPassword }
        : { privateKey: input.sshKey }),
    };

    // Connect, scan, import domains — all non-blocking
    this.connectAndScan(server.id, opts).catch(
      (err) => logger.error({ err, serverId: server.id }, 'Background scan failed'),
    );

    const { sshKey: _, sshPassword: __, ...rest } = server;
    return rest;
  }

  async updateServer(id: string, userId: string, input: UpdateServerInput) {
    const existing = await repo.findById(id, userId);
    if (!existing) throw new NotFoundError('Server');

    const server = await repo.update(id, userId, {
      name: input.name,
      ip: input.ip,
      sshPort: input.sshPort,
      sshUser: input.sshUser,
    });
    if (!server) throw new NotFoundError('Server');
    const { sshKey: _, ...rest } = server;
    return rest;
  }

  async deleteServer(id: string, userId: string) {
    const deleted = await repo.delete(id, userId);
    if (!deleted) throw new NotFoundError('Server');
  }

  async testConnection(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    await testSshConnection(this.getSshOpts(server));
    await repo.updateStatus(id, 'active');
    return { connected: true };
  }

  async provisionServer(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    await repo.updateStatus(id, 'pending');
    await installAgent(this.getSshOpts(server));
    await repo.updateStatus(id, 'active');
    return { provisioned: true };
  }

  async pingAgent(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const alive = await agentService.ping(server.ip);
    return { alive };
  }

  async scanServerAction(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const opts = this.getSshOpts(server);
    const scanData = await scanServer(opts);
    await repo.updateScanData(id, scanData as unknown as Record<string, unknown>);
    const imported = await this.syncDomainsFromScan(id, scanData.nginxDomainDetails ?? [], true);
    return { scanData, importedDomains: imported };
  }

  async rebootServer(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    await rebootServer(this.getSshOpts(server));
    await repo.updateStatus(id, 'offline');
    return { scheduled: true, action: 'reboot' };
  }

  async shutdownServer(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    await shutdownServer(this.getSshOpts(server));
    await repo.updateStatus(id, 'offline');
    return { scheduled: true, action: 'shutdown' };
  }

  async scanAndImportDomains(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const discovered = await scanNginxDomains(this.getSshOpts(server));

    const results: { domain: string; status: 'imported' | 'exists' }[] = [];

    for (const d of discovered) {
      const existing = await domainRepo.findByDomain(d.domain);
      if (existing) {
        results.push({ domain: d.domain, status: 'exists' });
        continue;
      }
      await domainRepo.create({
        serverId: id,
        domain: d.domain,
        rootPath: d.rootPath || `/var/www/${d.domain}`,
        port: 80,
        sslEnabled: d.sslEnabled,
        status: 'active',
      });
      results.push({ domain: d.domain, status: 'imported' });
      logger.info({ domain: d.domain, serverId: id }, 'Domain imported from nginx scan');
    }

    return { scanned: discovered.length, results };
  }

  async reinstallStack(id: string, userId: string, confirm: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    if (confirm !== server.name) {
      throw new AppError('Confirmation text does not match server name', 400, 'CONFIRM_MISMATCH');
    }
    await repo.updateStatus(id, 'pending');
    try {
      const log = await reinstallStack(this.getSshOpts(server));
      await repo.updateStatus(id, 'active');
      return { success: true, log };
    } catch (err) {
      await repo.updateStatus(id, 'error');
      throw err;
    }
  }

  private getSshOpts(server: Parameters<typeof buildSshOptions>[0]) {
    return buildSshOptions(server);
  }

  /**
   * Nginx taramasından gelen domain bilgilerini DB'ye senkronize eder.
   * @param updateRootPath true ise mevcut domain'in rootPath'i farklıysa günceller (manüel yeniden tarama).
   *                       false ise sadece yeni domain'leri ekler (otomatik ilk tarama).
   */
  private async syncDomainsFromScan(
    serverId: string,
    domainDetails: Array<{ domain: string; rootPath?: string }>,
    updateRootPath: boolean,
  ): Promise<string[]> {
    const SKIP_LIST = new Set(['default', 'cubiqport', 'port8083']);
    const imported: string[] = [];

    for (const { domain, rootPath } of domainDetails) {
      if (SKIP_LIST.has(domain)) continue;

      const existing = await domainRepo.findByDomain(domain);
      if (!existing) {
        await domainRepo.create({
          serverId,
          domain,
          rootPath: rootPath || `/var/www/${domain}`,
          port: 80,
          sslEnabled: false,
          status: 'active',
        });
        imported.push(domain);
        logger.info({ domain, rootPath }, 'Domain imported from scan');
      } else if (updateRootPath && rootPath && existing.rootPath !== rootPath) {
        await domainRepo.update(existing.id, { rootPath });
        logger.info({ domain, rootPath }, 'Domain rootPath updated from scan');
      }
    }

    return imported;
  }

  private async connectAndScan(serverId: string, opts: SshConnectionOptions) {
    try {
      await testSshConnection(opts);
      await repo.updateStatus(serverId, 'active');
      logger.info({ serverId }, 'SSH connection verified');
    } catch {
      await repo.updateStatus(serverId, 'error');
      return;
    }

    // Full server scan
    try {
      const scanData = await scanServer(opts);
      await repo.updateScanData(serverId, scanData as unknown as Record<string, unknown>);
      logger.info({ serverId }, 'Server scan complete');
      await this.syncDomainsFromScan(serverId, scanData.nginxDomainDetails ?? [], false);
    } catch (err) {
      logger.warn({ err, serverId }, 'Server scan failed — server still active');
    }
  }

  // ─── Docker Container Management ─────────────────────────────────────────

  private async getServerForSsh(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    return server;
  }

  async listContainers(id: string, userId: string) {
    const server = await this.getServerForSsh(id, userId);
    const opts = this.getSshOpts(server);
    return listContainersWithStats(opts);
  }

  async getContainerLogs(id: string, userId: string, containerName: string, lines: number) {
    const server = await this.getServerForSsh(id, userId);
    const opts = this.getSshOpts(server);
    return getContainerLogs(opts, containerName, lines);
  }

  async containerAction(
    id: string,
    userId: string,
    containerName: string,
    action: 'restart' | 'stop' | 'remove',
  ) {
    const server = await this.getServerForSsh(id, userId);
    const opts = this.getSshOpts(server);
    if (action === 'restart') await restartContainer(opts, containerName);
    else if (action === 'stop') await stopContainer(opts, containerName);
    else if (action === 'remove') await removeContainer(opts, containerName, true);
  }
}
