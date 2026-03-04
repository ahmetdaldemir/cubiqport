import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { dnsRecords, type DnsRecord, type NewDnsRecord } from '../../db/schema.js';

export class DnsRepository {
  async findByDomainId(domainId: string): Promise<DnsRecord[]> {
    return db.query.dnsRecords.findMany({
      where: eq(dnsRecords.domainId, domainId),
      orderBy: (r, { asc }) => [asc(r.type), asc(r.name)],
    });
  }

  async findById(id: string): Promise<DnsRecord | undefined> {
    return db.query.dnsRecords.findFirst({ where: eq(dnsRecords.id, id) });
  }

  async create(data: NewDnsRecord): Promise<DnsRecord> {
    const [record] = await db.insert(dnsRecords).values(data).returning();
    return record;
  }

  async update(id: string, data: Partial<NewDnsRecord>): Promise<DnsRecord | undefined> {
    const [record] = await db
      .update(dnsRecords)
      .set(data)
      .where(eq(dnsRecords.id, id))
      .returning();
    return record;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(dnsRecords)
      .where(eq(dnsRecords.id, id))
      .returning({ id: dnsRecords.id });
    return result.length > 0;
  }
}
