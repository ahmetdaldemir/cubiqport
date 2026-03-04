import Cloudflare from 'cloudflare';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { DnsRecordType } from '@cubiqport/shared';

export interface CloudflareRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

export class CloudflareService {
  private client: Cloudflare;
  private zoneId: string;

  constructor() {
    if (!config.CLOUDFLARE_API_TOKEN || !config.CLOUDFLARE_ZONE_ID) {
      logger.warn('Cloudflare credentials not configured — DNS operations will be skipped');
    }
    this.client = new Cloudflare({ apiToken: config.CLOUDFLARE_API_TOKEN });
    this.zoneId = config.CLOUDFLARE_ZONE_ID ?? '';
  }

  private assertConfigured() {
    if (!config.CLOUDFLARE_API_TOKEN || !config.CLOUDFLARE_ZONE_ID) {
      throw new AppError('Cloudflare is not configured', 503, 'CLOUDFLARE_NOT_CONFIGURED');
    }
  }

  async createRecord(params: {
    type: DnsRecordType;
    name: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  }): Promise<CloudflareRecord> {
    this.assertConfigured();
    try {
      const record = await this.client.dns.records.create({
        zone_id: this.zoneId,
        type: params.type as 'A',
        name: params.name,
        content: params.content,
        ttl: params.ttl ?? 1,
        proxied: params.proxied ?? false,
      });
      logger.info({ id: record.id }, 'Created Cloudflare DNS record');
      return {
        id: record.id ?? '',
        type: String(record.type ?? params.type),
        name: String(record.name ?? params.name),
        content: String(record.content ?? params.content),
        ttl: record.ttl ?? 1,
        proxied: Boolean((record as { proxied?: boolean }).proxied ?? false),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Cloudflare create failed: ${msg}`, 502, 'CLOUDFLARE_ERROR');
    }
  }

  async updateRecord(
    cloudflareId: string,
    params: { name: string; type: DnsRecordType; content: string; ttl?: number; proxied?: boolean },
  ): Promise<void> {
    this.assertConfigured();
    try {
      await this.client.dns.records.update(cloudflareId, {
        zone_id: this.zoneId,
        type: params.type as 'A',
        name: params.name,
        content: params.content,
        ttl: params.ttl ?? 1,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Cloudflare update failed: ${msg}`, 502, 'CLOUDFLARE_ERROR');
    }
  }

  async deleteRecord(cloudflareId: string): Promise<void> {
    this.assertConfigured();
    try {
      await this.client.dns.records.delete(cloudflareId, { zone_id: this.zoneId });
      logger.info({ cloudflareId }, 'Deleted Cloudflare DNS record');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Cloudflare delete failed: ${msg}`, 502, 'CLOUDFLARE_ERROR');
    }
  }

  async listRecords(name?: string): Promise<CloudflareRecord[]> {
    this.assertConfigured();
    const params: { zone_id: string; name?: string } = { zone_id: this.zoneId };
    if (name) params.name = name;
    const result = await this.client.dns.records.list(params);
    return (result.result ?? []).map((r) => ({
      id: r.id ?? '',
      type: String(r.type ?? ''),
      name: String(r.name ?? ''),
      content: String(r.content ?? ''),
      ttl: r.ttl ?? 1,
      proxied: Boolean((r as { proxied?: boolean }).proxied ?? false),
    }));
  }
}
