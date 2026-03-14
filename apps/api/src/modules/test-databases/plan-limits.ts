import { db } from '../../db/index.js';
import { subscriptions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/** Demo test DBs (on platform server): 50 MB each, PostgreSQL and MySQL only. */
export const DEMO_MAX_STORAGE_MB = 50;
export const FREE_MAX_DATABASES = 3;
export const FREE_MAX_STORAGE_MB = DEMO_MAX_STORAGE_MB;
export const PAID_MAX_DATABASES = 5;
export const PAID_MAX_STORAGE_MB = 1024;

export interface TestDbPlanLimits {
  maxDatabases: number;
  maxStorageMb: number;
}

export async function getTestDbPlanLimits(userId: string): Promise<TestDbPlanLimits> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    columns: { status: true },
  });
  const isPaid = sub?.status === 'active';
  return {
    maxDatabases: isPaid ? PAID_MAX_DATABASES : FREE_MAX_DATABASES,
    maxStorageMb: isPaid ? PAID_MAX_STORAGE_MB : FREE_MAX_STORAGE_MB,
  };
}
