import { DomainRepository } from './domain.repository.js';
import { ServerRepository } from '../servers/server.repository.js';
import { DnsRepository } from '../dns/dns.repository.js';
import { CloudflareService } from '../../services/cloudflare.service.js';
import { AgentService } from '../../services/agent.service.js';
import { NotFoundError, ConflictError, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { CreateDomainInput, UpdateDomainInput } from '@cubiqport/shared';

const domainRepo = new DomainRepository();
const serverRepo = new ServerRepository();
const dnsRepo = new DnsRepository();
const cloudflare = new CloudflareService();
const agentService = new AgentService();

export class DomainService {
  async listDomains(userId: string) {
    return domainRepo.findAll(userId);
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

    const existing = await domainRepo.findByDomain(input.domain);
    if (existing) throw new ConflictError(`Domain '${input.domain}' already exists`);

    const domain = await domainRepo.create({
      serverId: input.serverId,
      domain: input.domain,
      rootPath: `${input.rootPath}/${input.domain}`,
      port: input.port,
      status: 'pending',
    });

    // Non-blocking orchestration
    this.orchestrateDomainSetup(domain.id, server.ip, domain.domain, domain.port, domain.rootPath).catch(
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

    // Clean up Cloudflare records
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
    serverIp: string,
    domainName: string,
    port: number,
    rootPath: string,
  ) {
    try {
      // Step 1 — Cloudflare DNS A record
      logger.info({ domainId }, 'Creating Cloudflare DNS record');
      const record = await cloudflare.createRecord({
        type: 'A',
        name: domainName,
        content: serverIp,
        proxied: false,
      });

      await dnsRepo.create({
        domainId,
        cloudflareId: record.id,
        type: 'A',
        name: domainName,
        content: serverIp,
        ttl: 1,
        proxied: false,
      });

      // Step 2 — nginx config via agent
      logger.info({ domainId }, 'Creating nginx config via agent');
      await agentService.createNginxConfig(serverIp, {
        domain: domainName,
        port,
        rootPath,
        sslEnabled: false,
      });

      await domainRepo.updateStatus(domainId, 'active');
      logger.info({ domainId }, 'Domain setup complete');
    } catch (err) {
      logger.error({ err, domainId }, 'Domain setup orchestration failed');
      await domainRepo.updateStatus(domainId, 'error');
      throw err;
    }
  }
}
