import { Worker, Job } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getBullMQConnectionOptions } from '../utils/redis-connection.js';
import type { AnalysisJobPayload } from '../queue/analysis.queue.js';
import { runAnalysisJob } from '../modules/analysis/run-analysis-job.js';

const concurrency = 2;

const worker = new Worker<AnalysisJobPayload>(
  'domain-analysis',
  async (job: Job<AnalysisJobPayload>) => {
    logger.info({ jobId: job.id, type: job.data.type, domainId: job.data.domainId }, 'Processing analysis job');
    try {
      await runAnalysisJob(job.data);
      logger.info({ jobId: job.id, type: job.data.type, domainId: job.data.domainId }, 'Analysis job completed');
    } catch (err) {
      logger.error({ err, jobId: job.id, type: job.data.type, domainId: job.data.domainId }, 'Analysis job failed');
      throw err;
    }
  },
  {
    connection: getBullMQConnectionOptions(config.REDIS_URL!),
    concurrency,
  },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Job failed');
});

export { worker };
