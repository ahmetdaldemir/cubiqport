import { db } from '../../db/index.js';
import { testDatabases } from '../../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import type { NewTestDatabase } from '../../db/schema.js';

export class TestDatabaseRepository {
  async create(data: NewTestDatabase) {
    const [row] = await db.insert(testDatabases).values(data).returning();
    return row;
  }

  async findById(id: string, userId: string) {
    return db.query.testDatabases.findFirst({
      where: and(eq(testDatabases.id, id), eq(testDatabases.userId, userId)),
    });
  }

  async listByUserId(userId: string) {
    return db.query.testDatabases.findMany({
      where: eq(testDatabases.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  async countByUserId(userId: string): Promise<number> {
    const [row] = await db
      .select({ cnt: count() })
      .from(testDatabases)
      .where(eq(testDatabases.userId, userId));
    return row?.cnt ?? 0;
  }

  /** Ports in use on this server (for allocation). */
  async getUsedPortsByServerId(serverId: string): Promise<Set<number>> {
    const rows = await db
      .select({ port: testDatabases.port })
      .from(testDatabases)
      .where(eq(testDatabases.serverId, serverId));
    return new Set(rows.map((r) => r.port));
  }

  async updateStatus(id: string, userId: string, status: 'creating' | 'running' | 'stopped' | 'error') {
    const [row] = await db
      .update(testDatabases)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(testDatabases.id, id), eq(testDatabases.userId, userId)))
      .returning();
    return row;
  }

  async updatePassword(id: string, userId: string, encryptedPassword: string) {
    const [row] = await db
      .update(testDatabases)
      .set({ password: encryptedPassword, updatedAt: new Date() })
      .where(and(eq(testDatabases.id, id), eq(testDatabases.userId, userId)))
      .returning();
    return row;
  }

  async updateStorageUsed(id: string, userId: string, storageUsedMb: number | null) {
    const [row] = await db
      .update(testDatabases)
      .set({ storageUsedMb, updatedAt: new Date() })
      .where(and(eq(testDatabases.id, id), eq(testDatabases.userId, userId)))
      .returning();
    return row;
  }

  async updateContainerAndStatus(
    id: string,
    userId: string,
    data: { containerName: string; status: 'creating' | 'running' | 'stopped' | 'error' },
  ) {
    const [row] = await db
      .update(testDatabases)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(testDatabases.id, id), eq(testDatabases.userId, userId)))
      .returning();
    return row;
  }

  async delete(id: string, userId: string) {
    const result = await db
      .delete(testDatabases)
      .where(and(eq(testDatabases.id, id), eq(testDatabases.userId, userId)))
      .returning({ id: testDatabases.id });
    return result.length > 0;
  }
}
