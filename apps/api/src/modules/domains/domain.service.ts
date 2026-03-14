import { randomBytes } from 'crypto';
import { DomainRepository } from './domain.repository.js';
import { ServerRepository } from '../servers/server.repository.js';
import { DnsRepository } from '../dns/dns.repository.js';
import { CloudflareService } from '../../services/cloudflare.service.js';
import { AgentService } from '../../services/agent.service.js';
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  deleteFileOrDir,
  makeDirectory,
  gitDeploy,
  createNginxConfigViaSsh,
  removeNginxConfigViaSsh,
  runRemoteCommand,
} from '../../services/ssh.service.js';
import { buildSshOptions, type ServerSshFields } from '../../utils/ssh-credentials.js';
import { decrypt } from '../../utils/encrypt.js';
import { NotFoundError, ConflictError, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { CreateDomainInput, UpdateDomainInput } from '@cubiqport/shared';

const domainRepo = new DomainRepository();
const serverRepo = new ServerRepository();
const dnsRepo = new DnsRepository();
const cloudflare = new CloudflareService();
const agentService = new AgentService();

export class DomainService {
  async listDomains(userId: string, serverId?: string) {
    return domainRepo.findAll(userId, serverId);
  }

  async getDomain(id: string, userId: string) {
    const domain = await domainRepo.findById(id, userId);
    if (!domain) throw new NotFoundError('Domain');
    return domain;
  }

  /**
   * Full domain creation flow:
   * 1. Validate server ownership
   * 2. Check domain uniqueness
   * 3. Create DB record
   * 4. Create Cloudflare DNS A record
   * 5. Call agent to create nginx config
   * 6. Enable site (symlink + reload)
   */
  async createDomain(userId: string, input: CreateDomainInput) {
    const server = await serverRepo.findById(input.serverId, userId);
    if (!server) throw new NotFoundError('Server');
    if (server.status !== 'active') {
      throw new AppError('Server must be active before adding domains', 400);
    }

    const existing = await domainRepo.findByDomainAndServer(input.domain, input.serverId);
    if (existing) throw new ConflictError(`Bu sunucuda '${input.domain}' domain'i zaten kayıtlı`);

    const domain = await domainRepo.create({
      serverId: input.serverId,
      domain: input.domain,
      rootPath: `${input.rootPath}/${input.domain}`,
      port: input.port,
      status: 'pending',
    });

    // Non-blocking orchestration (Cloudflare DNS + nginx via agent veya SSH fallback)
    this.orchestrateDomainSetup(domain.id, server, domain.domain, domain.port, domain.rootPath).catch(
      (err) => logger.error({ err, domainId: domain.id }, 'Domain setup failed'),
    );

    return domain;
  }

  async updateDomain(id: string, userId: string, input: UpdateDomainInput) {
    const domain = await domainRepo.findById(id, userId);
    if (!domain) throw new NotFoundError('Domain');
    const updated = await domainRepo.update(id, input);
    if (!updated) throw new NotFoundError('Domain');
    return updated;
  }

  async deleteDomain(id: string, userId: string) {
    const domain = await domainRepo.findById(id, userId);
    if (!domain) throw new NotFoundError('Domain');

    const server = await serverRepo.findByIdUnscoped(domain.serverId);
    if (server) {
      try {
        await agentService.removeNginxConfig(server.ip, domain.domain);
        logger.info({ domainId: id, domain: domain.domain }, 'Nginx config removed via agent');
      } catch (agentErr) {
        logger.warn({ agentErr, domainId: id }, 'Agent nginx/remove failed — trying SSH');
        try {
          const opts = buildSshOptions(server);
          await removeNginxConfigViaSsh(opts, domain.domain);
          logger.info({ domainId: id }, 'Nginx config removed via SSH');
        } catch (sshErr) {
          logger.warn({ sshErr, domainId: id }, 'SSH nginx remove failed — continuing with domain delete');
        }
      }
    }

    const records = await dnsRepo.findByDomainId(id);
    for (const rec of records) {
      if (rec.cloudflareId) {
        await cloudflare.deleteRecord(rec.cloudflareId).catch((err) =>
          logger.warn({ err }, 'Failed to delete Cloudflare record during domain deletion'),
        );
      }
    }

    const deleted = await domainRepo.delete(id, userId);
    if (!deleted) throw new NotFoundError('Domain');
  }

  // ─── File Manager ────────────────────────────────────────────────────────────

  private async getDomainWithServer(id: string, userId: string) {
    const domain = await domainRepo.findById(id, userId);
    if (!domain) throw new NotFoundError('Domain');
    const server = await serverRepo.findByIdUnscoped(domain.serverId);
    if (!server) throw new NotFoundError('Server');
    const opts =
      server.sshAuthType === 'password' && server.sshPassword
        ? { host: server.ip, port: server.sshPort, username: server.sshUser, password: decrypt(server.sshPassword) }
        : { host: server.ip, port: server.sshPort, username: server.sshUser, privateKey: decrypt(server.sshKey ?? '') };
    return { domain, server, opts };
  }

  async listFiles(id: string, userId: string, dirPath: string) {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    const base = domain.rootPath;
    const safePath = dirPath.startsWith(base) ? dirPath : base;
    return listDirectory(opts, safePath);
  }

  async readFile(id: string, userId: string, filePath: string) {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    if (!filePath.startsWith(domain.rootPath)) {
      throw new AppError('Path outside domain root', 403, 'FORBIDDEN');
    }
    return readFileContent(opts, filePath);
  }

  async writeFile(id: string, userId: string, filePath: string, content: string) {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    if (!filePath.startsWith(domain.rootPath)) {
      throw new AppError('Path outside domain root', 403, 'FORBIDDEN');
    }
    await writeFileContent(opts, filePath, content);
  }

  async deleteFile(id: string, userId: string, filePath: string, recursive = false) {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    if (!filePath.startsWith(domain.rootPath)) {
      throw new AppError('Path outside domain root', 403, 'FORBIDDEN');
    }
    await deleteFileOrDir(opts, filePath, recursive);
  }

  async mkdir(id: string, userId: string, dirPath: string) {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    if (!dirPath.startsWith(domain.rootPath)) {
      throw new AppError('Path outside domain root', 403, 'FORBIDDEN');
    }
    await makeDirectory(opts, dirPath);
  }

  // ─── Nginx config (sites-available/{domain}.conf) ───────────────────────────────
  private nginxConfigPath(domainName: string): string {
    return `/etc/nginx/sites-available/${domainName}.conf`;
  }

  async getNginxConfig(id: string, userId: string): Promise<{ content: string; path: string }> {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    const path = this.nginxConfigPath(domain.domain);
    try {
      const content = await readFileContent(opts, path, 64 * 1024);
      return { content, path };
    } catch (err) {
      throw new NotFoundError('Nginx config dosyası bulunamadı (henüz oluşturulmamış olabilir)');
    }
  }

  async updateNginxConfig(id: string, userId: string, content: string): Promise<{ path: string; reloaded: boolean }> {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    const path = this.nginxConfigPath(domain.domain);
    await writeFileContent(opts, path, content);
    const test = await runRemoteCommand(opts, 'nginx -t 2>&1');
    if (test.code !== 0) {
      throw new AppError(`Nginx config hatası: ${test.stdout || test.stderr}`, 400, 'NGINX_INVALID');
    }
    await runRemoteCommand(opts, 'systemctl reload nginx 2>&1 || nginx -s reload 2>&1');
    return { path, reloaded: true };
  }

  // ─── GitHub Deploy ────────────────────────────────────────────────────────────

  async setGithub(
    id: string,
    userId: string,
    data: { githubRepo: string; githubBranch: string; deployCommand?: string },
  ) {
    const domain = await domainRepo.findById(id, userId);
    if (!domain) throw new NotFoundError('Domain');
    const secret = randomBytes(20).toString('hex');
    const updated = await domainRepo.update(id, {
      githubRepo: data.githubRepo,
      githubBranch: data.githubBranch || 'main',
      deployCommand: data.deployCommand,
      webhookSecret: secret,
    });
    return { ...updated, webhookSecret: secret };
  }

  async deploy(id: string, userId: string) {
    const { domain, opts } = await this.getDomainWithServer(id, userId);
    if (!domain.githubRepo) {
      throw new AppError('GitHub repo not configured', 400, 'NO_REPO');
    }
    const log = await gitDeploy(
      opts,
      domain.rootPath,
      domain.githubRepo,
      domain.githubBranch ?? 'main',
      domain.deployCommand ?? undefined,
    );
    await domainRepo.update(id, { lastDeployAt: new Date(), deployLog: log });
    return { success: true, log };
  }

  async handleWebhook(domainId: string, secret: string) {
    const domain = await domainRepo.findByIdUnscoped(domainId);
    if (!domain) throw new NotFoundError('Domain');
    if (domain.webhookSecret !== secret) throw new AppError('Invalid webhook secret', 403, 'FORBIDDEN');
    const server = await serverRepo.findByIdUnscoped(domain.serverId);
    if (!server) throw new NotFoundError('Server');
    const opts =
      server.sshAuthType === 'password' && server.sshPassword
        ? { host: server.ip, port: server.sshPort, username: server.sshUser, password: decrypt(server.sshPassword) }
        : { host: server.ip, port: server.sshPort, username: server.sshUser, privateKey: decrypt(server.sshKey ?? '') };
    const log = await gitDeploy(
      opts,
      domain.rootPath,
      domain.githubRepo!,
      domain.githubBranch ?? 'main',
      domain.deployCommand ?? undefined,
    );
    await domainRepo.update(domainId, { lastDeployAt: new Date(), deployLog: log });
    return { success: true };
  }

  async enableSsl(id: string, userId: string, email: string) {
    const domain = await domainRepo.findById(id, userId);
    if (!domain) throw new NotFoundError('Domain');

    const server = await serverRepo.findByIdUnscoped(domain.serverId);
    if (!server) throw new NotFoundError('Server');

    await agentService.installSsl(server.ip, { domain: domain.domain, email });
    await domainRepo.update(id, { sslEnabled: true, sslEmail: email, status: 'active' });

    return { sslEnabled: true };
  }

  private async orchestrateDomainSetup(
    domainId: string,
    server: ServerSshFields,
    domainName: string,
    port: number,
    rootPath: string,
  ) {
    try {
      // Step 1 — Cloudflare DNS A record (optional — skip if not configured)
      const cfConfigured = !!(
        process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID
      );
      if (cfConfigured) {
        logger.info({ domainId }, 'Creating Cloudflare DNS record');
        try {
          const record = await cloudflare.createRecord({
            type: 'A',
            name: domainName,
            content: server.ip,
            proxied: false,
          });
          await dnsRepo.create({
            domainId,
            cloudflareId: record.id,
            type: 'A',
            name: domainName,
            content: server.ip,
            ttl: 1,
            proxied: false,
          });
        } catch (cfErr) {
          logger.warn({ cfErr, domainId }, 'Cloudflare DNS failed — continuing without DNS record');
        }
      } else {
        logger.info({ domainId }, 'Cloudflare not configured — skipping DNS step');
      }

      // Step 2 — nginx host: önce agent, başarısızsa SSH ile oluştur
      logger.info({ domainId }, 'Creating nginx config');
      let nginxDone = false;
      try {
        await agentService.createNginxConfig(server.ip, {
          domain: domainName,
          port,
          rootPath,
          sslEnabled: false,
        });
        nginxDone = true;
      } catch (agentErr) {
        logger.warn({ agentErr, domainId }, 'Agent unreachable — trying nginx via SSH');
      }
      if (!nginxDone) {
        try {
          await createNginxConfigViaSsh(buildSshOptions(server), {
            domain: domainName,
            port,
            rootPath,
            sslEnabled: false,
          });
          logger.info({ domainId }, 'Nginx config created via SSH');
        } catch (sshErr) {
          logger.error({ sshErr, domainId }, 'Nginx config via SSH failed');
          await domainRepo.updateStatus(domainId, 'error');
          throw sshErr;
        }
      }

      await domainRepo.updateStatus(domainId, 'active');
      logger.info({ domainId }, 'Domain setup complete');
    } catch (err) {
      logger.error({ err, domainId }, 'Domain setup orchestration failed');
      await domainRepo.updateStatus(domainId, 'error');
      throw err;
    }
  }
}
