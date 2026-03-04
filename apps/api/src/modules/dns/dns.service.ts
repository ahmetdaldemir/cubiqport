import { DnsRepository } from './dns.repository.js';
import { DomainRepository } from '../domains/domain.repository.js';
import { CloudflareService } from '../../services/cloudflare.service.js';
import { NotFoundError } from '../../utils/errors.js';
import type { CreateDnsRecordInput } from '@cubiqport/shared';

const dnsRepo = new DnsRepository();
const domainRepo = new DomainRepository();
const cloudflare = new CloudflareService();

export class DnsService {
  async listRecords(domainId: string, userId: string) {
    const domain = await domainRepo.findById(domainId, userId);
    if (!domain) throw new NotFoundError('Domain');
    return dnsRepo.findByDomainId(domainId);
  }

  async createRecord(userId: string, input: CreateDnsRecordInput) {
    const domain = await domainRepo.findById(input.domainId, userId);
    if (!domain) throw new NotFoundError('Domain');

    // Sync with Cloudflare
    const cfRecord = await cloudflare.createRecord({
      type: input.type,
      name: input.name,
      content: input.content,
      ttl: input.ttl,
      proxied: input.proxied,
    });

    return dnsRepo.create({
      domainId: input.domainId,
      cloudflareId: cfRecord.id,
      type: input.type,
      name: input.name,
      content: input.content,
      ttl: input.ttl,
      proxied: input.proxied,
    });
  }

  async deleteRecord(id: string, userId: string) {
    const record = await dnsRepo.findById(id);
    if (!record) throw new NotFoundError('DNS record');

    // Verify user owns the domain
    const domain = await domainRepo.findById(record.domainId, userId);
    if (!domain) throw new NotFoundError('Domain');

    if (record.cloudflareId) {
      await cloudflare.deleteRecord(record.cloudflareId);
    }

    await dnsRepo.delete(id);
  }
}
