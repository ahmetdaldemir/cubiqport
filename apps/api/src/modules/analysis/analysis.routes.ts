import { FastifyInstance } from 'fastify';
import {
  startSeoAnalysis,
  listSeoReports,
  getSeoReport,
  startStressTest,
  listStressTestReports,
  getStressTestReport,
  startSecurityScan,
  listSecurityScanReports,
  getSecurityScanReport,
} from './analysis.controller.js';

type IdParam = { Params: { id: string } };
type ReportIdParam = { Params: { id: string; reportId: string } };

export async function analysisRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  // SEO
  fastify.post<IdParam>('/:id/analysis/seo', { ...auth }, startSeoAnalysis);
  fastify.get<IdParam>('/:id/analysis/seo', { ...auth }, listSeoReports);
  fastify.get<ReportIdParam>('/:id/analysis/seo/:reportId', { ...auth }, getSeoReport);

  // Stress test
  fastify.post<IdParam>('/:id/analysis/stress', { ...auth }, startStressTest);
  fastify.get<IdParam>('/:id/analysis/stress', { ...auth }, listStressTestReports);
  fastify.get<ReportIdParam>('/:id/analysis/stress/:reportId', { ...auth }, getStressTestReport);

  // Security scan
  fastify.post<IdParam>('/:id/analysis/security', { ...auth }, startSecurityScan);
  fastify.get<IdParam>('/:id/analysis/security', { ...auth }, listSecurityScanReports);
  fastify.get<ReportIdParam>('/:id/analysis/security/:reportId', { ...auth }, getSecurityScanReport);
}
