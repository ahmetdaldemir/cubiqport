import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { config, hasRedis } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getBullMQConnectionOptions } from '../utils/redis-connection.js';
import { runAnalysisJob } from '../modules/analysis/run-analysis-job.js';

export const ANALYSIS_QUEUE_NAME = 'domain-analysis';

export type AnalysisJobType = 'seo' | 'stress' | 'security';

export interface AnalysisJobPayload {
  type: AnalysisJobType;
  domainId: string;
  domainHost: string;
}

const connection = hasRedis() ? getBullMQConnectionOptions(config.REDIS_URL!) : null;

export const analysisQueue: Queue<AnalysisJobPayload> | null = connection
  ? new Queue<AnalysisJobPayload>(ANALYSIS_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
      },
    })
  : null;

export async function addAnalysisJob(payload: AnalysisJobPayload): Promise<string> {
  if (analysisQueue) {
    const job = await analysisQueue.add('run', payload, { jobId: undefined });
    logger.info({ jobId: job.id, type: payload.type, domainId: payload.domainId }, 'Analysis job queued');
    return job.id ?? '';
  }
  const jobId = randomUUID();
  setImmediate(() => {
    runAnalysisJob(payload).catch((err) => {
      logger.error({ err, jobId, type: payload.type, domainId: payload.domainId }, 'Inline analysis job failed');
    });
  });
  logger.info({ jobId, type: payload.type, domainId: payload.domainId }, 'Analysis job running inline (no Redis)');
  return jobId;
}
