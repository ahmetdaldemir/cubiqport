import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { deployments, type Deployment, type NewDeployment } from '../../db/schema.js';

export class DeploymentRepository {
  async findByDomainId(domainId: string): Promise<Deployment[]> {
    return db.query.deployments.findMany({
      where: eq(deployments.domainId, domainId),
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });
  }

  async findById(id: string): Promise<Deployment | undefined> {
    return db.query.deployments.findFirst({ where: eq(deployments.id, id) });
  }

  async create(data: NewDeployment): Promise<Deployment> {
    const [deployment] = await db.insert(deployments).values(data).returning();
    return deployment;
  }

  async updateStatus(id: string, status: Deployment['status'], logs?: string): Promise<void> {
    await db
      .update(deployments)
      .set({ status, ...(logs !== undefined && { logs }), updatedAt: new Date() })
      .where(eq(deployments.id, id));
  }

  async appendLog(id: string, chunk: string): Promise<void> {
    // Drizzle doesn't support string concatenation — do it in raw SQL pattern
    const existing = await this.findById(id);
    const currentLogs = existing?.logs ?? '';
    await db
      .update(deployments)
      .set({ logs: currentLogs + chunk, updatedAt: new Date() })
      .where(eq(deployments.id, id));
  }
}
