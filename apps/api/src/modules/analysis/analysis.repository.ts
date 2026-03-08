import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  seoReports,
  stressTestReports,
  securityScanReports,
  domains,
  servers,
  type SeoReportRow,
  type NewSeoReportRow,
  type StressTestReportRow,
  type NewStressTestReportRow,
  type SecurityScanReportRow,
  type NewSecurityScanReportRow,
} from '../../db/schema.js';

/** Ensure domain is owned by user (via server). Returns domainId if valid. */
export async function ensureDomainOwnership(domainId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ domainId: domains.id })
    .from(domains)
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(domains.id, domainId), eq(servers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// ─── SEO Reports ───────────────────────────────────────────────────────────────
export async function createSeoReport(data: NewSeoReportRow): Promise<SeoReportRow> {
  const [row] = await db.insert(seoReports).values(data).returning();
  return row;
}

export async function findSeoReportsByDomainId(domainId: string, userId: string): Promise<SeoReportRow[]> {
  const rows = await db
    .select({ report: seoReports })
    .from(seoReports)
    .innerJoin(domains, eq(seoReports.domainId, domains.id))
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(seoReports.domainId, domainId), eq(servers.userId, userId)))
    .orderBy(desc(seoReports.createdAt));
  return rows.map((r) => r.report);
}

export async function findSeoReportById(reportId: string, userId: string): Promise<SeoReportRow | undefined> {
  const rows = await db
    .select({ report: seoReports })
    .from(seoReports)
    .innerJoin(domains, eq(seoReports.domainId, domains.id))
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(seoReports.id, reportId), eq(servers.userId, userId)))
    .limit(1);
  return rows[0]?.report;
}

// ─── Stress Test Reports ─────────────────────────────────────────────────────
export async function createStressTestReport(data: NewStressTestReportRow): Promise<StressTestReportRow> {
  const [row] = await db.insert(stressTestReports).values(data).returning();
  return row;
}

export async function findStressTestReportsByDomainId(
  domainId: string,
  userId: string,
): Promise<StressTestReportRow[]> {
  const rows = await db
    .select({ report: stressTestReports })
    .from(stressTestReports)
    .innerJoin(domains, eq(stressTestReports.domainId, domains.id))
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(stressTestReports.domainId, domainId), eq(servers.userId, userId)))
    .orderBy(desc(stressTestReports.createdAt));
  return rows.map((r) => r.report);
}

export async function findStressTestReportById(
  reportId: string,
  userId: string,
): Promise<StressTestReportRow | undefined> {
  const rows = await db
    .select({ report: stressTestReports })
    .from(stressTestReports)
    .innerJoin(domains, eq(stressTestReports.domainId, domains.id))
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(stressTestReports.id, reportId), eq(servers.userId, userId)))
    .limit(1);
  return rows[0]?.report;
}

// ─── Security Scan Reports ───────────────────────────────────────────────────
export async function createSecurityScanReport(data: NewSecurityScanReportRow): Promise<SecurityScanReportRow> {
  const [row] = await db.insert(securityScanReports).values(data).returning();
  return row;
}

export async function findSecurityScanReportsByDomainId(
  domainId: string,
  userId: string,
): Promise<SecurityScanReportRow[]> {
  const rows = await db
    .select({ report: securityScanReports })
    .from(securityScanReports)
    .innerJoin(domains, eq(securityScanReports.domainId, domains.id))
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(securityScanReports.domainId, domainId), eq(servers.userId, userId)))
    .orderBy(desc(securityScanReports.createdAt));
  return rows.map((r) => r.report);
}

export async function findSecurityScanReportById(
  reportId: string,
  userId: string,
): Promise<SecurityScanReportRow | undefined> {
  const rows = await db
    .select({ report: securityScanReports })
    .from(securityScanReports)
    .innerJoin(domains, eq(securityScanReports.domainId, domains.id))
    .innerJoin(servers, eq(domains.serverId, servers.id))
    .where(and(eq(securityScanReports.id, reportId), eq(servers.userId, userId)))
    .limit(1);
  return rows[0]?.report;
}
