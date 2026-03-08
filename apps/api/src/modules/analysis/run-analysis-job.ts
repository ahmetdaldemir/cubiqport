/**
 * Tek bir analiz işini çalıştırır (SEO, stress, security).
 * Hem worker hem Redis yokken API içinde inline çalıştırmak için kullanılır.
 */
import { logger } from '../../utils/logger.js';
import type { AnalysisJobPayload } from '../../queue/analysis.queue.js';
import { runSeoAnalysis } from './services/seo-analysis.service.js';
import { runStressTest } from './services/stress-test.service.js';
import { runSecurityScan } from './services/security-scan.service.js';
import {
  createSeoReport,
  createStressTestReport,
  createSecurityScanReport,
} from './analysis.repository.js';

export async function runAnalysisJob(payload: AnalysisJobPayload): Promise<void> {
  const { type, domainId, domainHost } = payload;
  logger.info({ type, domainId }, 'Running analysis job');

  if (type === 'seo') {
    const result = await runSeoAnalysis(domainHost);
    await createSeoReport({
      domainId,
      title: result.title,
      metaDescription: result.metaDescription,
      h1Tags: result.h1Tags,
      loadTimeMs: result.loadTimeMs,
      mobileFriendly: result.mobileFriendly,
      lighthouseScore: result.lighthouseScore,
      brokenLinksCount: result.brokenLinksCount,
      sitemapExists: result.sitemapExists,
      robotsTxtExists: result.robotsTxtExists,
      seoScore: result.seoScore,
      rawData: result.rawData,
    });
  } else if (type === 'stress') {
    const result = await runStressTest(domainHost);
    await createStressTestReport({
      domainId,
      requestsPerSecond: result.requestsPerSecond,
      avgResponseTimeMs: result.avgResponseTimeMs,
      maxResponseTimeMs: result.maxResponseTimeMs,
      errorRate: result.errorRate,
      concurrentUsers: result.concurrentUsers,
      durationSeconds: result.durationSeconds,
      rawData: result.rawData,
    });
  } else if (type === 'security') {
    const result = await runSecurityScan(domainHost);
    await createSecurityScanReport({
      domainId,
      securityScore: result.securityScore,
      httpsEnabled: result.httpsEnabled,
      securityHeaders: result.securityHeaders,
      openPorts: result.openPorts,
      vulnerabilities: result.vulnerabilities,
      sslValid: result.sslValid,
      directoryListingEnabled: result.directoryListingEnabled,
      rawData: result.rawData,
    });
  } else {
    throw new Error(`Unknown analysis type: ${type}`);
  }
  logger.info({ type, domainId }, 'Analysis job completed');
}
