import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { servers, type Server, type NewServer } from '../../db/schema.js';

export class ServerRepository {
  async findAll(userId: string): Promise<Server[]> {
    return db.query.servers.findMany({
      where: eq(servers.userId, userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
  }

  async findById(id: string, userId: string): Promise<Server | undefined> {
    return db.query.servers.findFirst({
      where: and(eq(servers.id, id), eq(servers.userId, userId)),
    });
  }

  async findByIdUnscoped(id: string): Promise<Server | undefined> {
    return db.query.servers.findFirst({ where: eq(servers.id, id) });
  }

  async create(data: NewServer): Promise<Server> {
    const [server] = await db.insert(servers).values(data).returning();
    return server;
  }

  async update(id: string, userId: string, data: Partial<NewServer>): Promise<Server | undefined> {
    const [server] = await db
      .update(servers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(servers.id, id), eq(servers.userId, userId)))
      .returning();
    return server;
  }

  async updateStatus(id: string, status: Server['status']): Promise<void> {
    await db.update(servers).set({ status, updatedAt: new Date() }).where(eq(servers.id, id));
  }

  async updateScanData(id: string, scanData: Record<string, unknown>): Promise<void> {
    await db.update(servers).set({ scanData, updatedAt: new Date() }).where(eq(servers.id, id));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(servers)
      .where(and(eq(servers.id, id), eq(servers.userId, userId)))
      .returning({ id: servers.id });
    return result.length > 0;
  }
}
