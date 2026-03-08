import { DomainRepository } from '../domains/domain.repository.js';
import { ensureDomainOwnership } from './analysis.repository.js';
import {
  findSeoReportsByDomainId,
  findSeoReportById,
  findStressTestReportsByDomainId,
  findStressTestReportById,
  findSecurityScanReportsByDomainId,
  findSecurityScanReportById,
} from './analysis.repository.js';
import { addAnalysisJob } from '../../queue/analysis.queue.js';
import { NotFoundError } from '../../utils/errors.js';

const domainRepo = new DomainRepository();

export class AnalysisService {
  async startSeoAnalysis(domainId: string, userId: string): Promise<{ jobId: string }> {
    const ok = await ensureDomainOwnership(domainId, userId);
    if (!ok) throw new NotFoundError('Domain');
    const domain = await domainRepo.findById(domainId, userId);
    if (!domain) throw new NotFoundError('Domain');
    const jobId = await addAnalysisJob({
      type: 'seo',
      domainId,
      domainHost: domain.domain,
    });
    return { jobId };
  }

  async startStressTest(domainId: string, userId: string): Promise<{ jobId: string }> {
    const ok = await ensureDomainOwnership(domainId, userId);
    if (!ok) throw new NotFoundError('Domain');
    const domain = await domainRepo.findById(domainId, userId);
    if (!domain) throw new NotFoundError('Domain');
    const jobId = await addAnalysisJob({
      type: 'stress',
      domainId,
      domainHost: domain.domain,
    });
    return { jobId };
  }

  async startSecurityScan(domainId: string, userId: string): Promise<{ jobId: string }> {
    const ok = await ensureDomainOwnership(domainId, userId);
    if (!ok) throw new NotFoundError('Domain');
    const domain = await domainRepo.findById(domainId, userId);
    if (!domain) throw new NotFoundError('Domain');
    const jobId = await addAnalysisJob({
      type: 'security',
      domainId,
      domainHost: domain.domain,
    });
    return { jobId };
  }

  async listSeoReports(domainId: string, userId: string) {
    const ok = await ensureDomainOwnership(domainId, userId);
    if (!ok) throw new NotFoundError('Domain');
    return findSeoReportsByDomainId(domainId, userId);
  }

  async getSeoReport(domainId: string, reportId: string, userId: string) {
    const report = await findSeoReportById(reportId, userId);
    if (!report || report.domainId !== domainId) throw new NotFoundError('Report');
    return report;
  }

  async listStressTestReports(domainId: string, userId: string) {
    const ok = await ensureDomainOwnership(domainId, userId);
    if (!ok) throw new NotFoundError('Domain');
    return findStressTestReportsByDomainId(domainId, userId);
  }

  async getStressTestReport(domainId: string, reportId: string, userId: string) {
    const report = await findStressTestReportById(reportId, userId);
    if (!report || report.domainId !== domainId) throw new NotFoundError('Report');
    return report;
  }

  async listSecurityScanReports(domainId: string, userId: string) {
    const ok = await ensureDomainOwnership(domainId, userId);
    if (!ok) throw new NotFoundError('Domain');
    return findSecurityScanReportsByDomainId(domainId, userId);
  }

  async getSecurityScanReport(domainId: string, reportId: string, userId: string) {
    const report = await findSecurityScanReportById(reportId, userId);
    if (!report || report.domainId !== domainId) throw new NotFoundError('Report');
    return report;
  }
}
