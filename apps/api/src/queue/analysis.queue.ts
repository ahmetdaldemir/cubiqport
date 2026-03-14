import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { runAnalysisJob } from '../modules/analysis/run-analysis-job.js';

export const ANALYSIS_QUEUE_NAME = 'domain-analysis';

export type AnalysisJobType = 'seo' | 'stress' | 'security';

export interface AnalysisJobPayload {
  type: AnalysisJobType;
  domainId: string;
  domainHost: string;
}

/** Analiz işi ekler — Redis yok, her zaman API içinde inline çalışır. */
export async function addAnalysisJob(payload: AnalysisJobPayload): Promise<string> {
  const jobId = randomUUID();
  setImmediate(() => {
    runAnalysisJob(payload).catch((err) => {
      logger.error({ err, jobId, type: payload.type, domainId: payload.domainId }, 'Inline analysis job failed');
    });
  });
  logger.info({ jobId, type: payload.type, domainId: payload.domainId }, 'Analysis job running inline');
  return jobId;
}
