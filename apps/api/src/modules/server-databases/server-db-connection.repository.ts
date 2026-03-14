import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { serverDbConnections, servers } from '../../db/schema.js';
import type { NewServerDbConnection } from '../../db/schema.js';

export class ServerDbConnectionRepository {
  async create(data: NewServerDbConnection) {
    const [row] = await db.insert(serverDbConnections).values(data).returning();
    return row!;
  }

  async findById(id: string, userId: string) {
    const rows = await db
      .select({ conn: serverDbConnections })
      .from(serverDbConnections)
      .innerJoin(servers, eq(serverDbConnections.serverId, servers.id))
      .where(and(eq(serverDbConnections.id, id), eq(servers.userId, userId)))
      .limit(1);
    return rows[0]?.conn;
  }

  async listByServerId(serverId: string, userId: string) {
    const rows = await db
      .select({ conn: serverDbConnections })
      .from(serverDbConnections)
      .innerJoin(servers, eq(serverDbConnections.serverId, servers.id))
      .where(and(eq(serverDbConnections.serverId, serverId), eq(servers.userId, userId)));
    return rows.map((r) => r.conn);
  }

  async delete(id: string, userId: string) {
    const conn = await this.findById(id, userId);
    if (!conn) return false;
    await db.delete(serverDbConnections).where(eq(serverDbConnections.id, id));
    return true;
  }
}
