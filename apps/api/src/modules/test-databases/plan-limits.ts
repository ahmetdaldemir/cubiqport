import { db } from '../../db/index.js';
import { subscriptions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/** Free: 1 DB, 100 MB. Paid (active): 5 DBs, 1024 MB per DB. */
export const FREE_MAX_DATABASES = 1;
export const FREE_MAX_STORAGE_MB = 100;
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
