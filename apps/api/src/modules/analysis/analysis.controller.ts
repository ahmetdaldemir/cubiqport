import { FastifyRequest, FastifyReply } from 'fastify';
import { AnalysisService } from './analysis.service.js';

const service = new AnalysisService();

type IdParam = { Params: { id: string } };
type ReportIdParam = { Params: { id: string; reportId: string } };

export async function startSeoAnalysis(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const { jobId } = await service.startSeoAnalysis(req.params.id, req.user.sub);
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function listSeoReports(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const list = await service.listSeoReports(req.params.id, req.user.sub);
  return reply.send({ success: true, data: list });
}

export async function getSeoReport(
  req: FastifyRequest<ReportIdParam>,
  reply: FastifyReply,
) {
  const report = await service.getSeoReport(req.params.id, req.params.reportId, req.user.sub);
  return reply.send({ success: true, data: report });
}

export async function startStressTest(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const { jobId } = await service.startStressTest(req.params.id, req.user.sub);
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function listStressTestReports(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const list = await service.listStressTestReports(req.params.id, req.user.sub);
  return reply.send({ success: true, data: list });
}

export async function getStressTestReport(
  req: FastifyRequest<ReportIdParam>,
  reply: FastifyReply,
) {
  const report = await service.getStressTestReport(req.params.id, req.params.reportId, req.user.sub);
  return reply.send({ success: true, data: report });
}

export async function startSecurityScan(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const { jobId } = await service.startSecurityScan(req.params.id, req.user.sub);
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function listSecurityScanReports(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const list = await service.listSecurityScanReports(req.params.id, req.user.sub);
  return reply.send({ success: true, data: list });
}

export async function getSecurityScanReport(
  req: FastifyRequest<ReportIdParam>,
  reply: FastifyReply,
) {
  const report = await service.getSecurityScanReport(req.params.id, req.params.reportId, req.user.sub);
  return reply.send({ success: true, data: report });
}
