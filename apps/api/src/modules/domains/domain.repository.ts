import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { domains, servers, type Domain, type NewDomain } from '../../db/schema.js';

export class DomainRepository {
  async findAll(userId: string): Promise<Domain[]> {
    return db
      .select({ domain: domains })
      .from(domains)
      .innerJoin(servers, and(eq(domains.serverId, servers.id), eq(servers.userId, userId)))
      .then((rows) => rows.map((r) => r.domain));
  }

  async findById(id: string, userId: string): Promise<Domain | undefined> {
    const rows = await db
      .select({ domain: domains })
      .from(domains)
      .innerJoin(servers, and(eq(domains.serverId, servers.id), eq(servers.userId, userId)))
      .where(eq(domains.id, id))
      .limit(1);
    return rows[0]?.domain;
  }

  async findByIdUnscoped(id: string): Promise<Domain | undefined> {
    return db.query.domains.findFirst({ where: eq(domains.id, id) });
  }

  async findByDomain(domain: string): Promise<Domain | undefined> {
    return db.query.domains.findFirst({ where: eq(domains.domain, domain) });
  }

  async create(data: NewDomain): Promise<Domain> {
    const [domain] = await db.insert(domains).values(data).returning();
    return domain;
  }

  async update(id: string, data: Partial<NewDomain>): Promise<Domain | undefined> {
    const [domain] = await db
      .update(domains)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(domains.id, id))
      .returning();
    return domain;
  }

  async updateStatus(id: string, status: Domain['status']): Promise<void> {
    await db.update(domains).set({ status, updatedAt: new Date() }).where(eq(domains.id, id));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    // Only delete if the user owns the server this domain belongs to
    const domain = await this.findById(id, userId);
    if (!domain) return false;
    await db.delete(domains).where(eq(domains.id, id));
    return true;
  }
}
