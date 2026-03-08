/**
 * Domain analysis worker — Redis varsa kuyruktaki SEO, stress, security işlerini işler.
 * Redis yoksa süreç boşta kalır (analiz işleri API sürecinde inline çalışır).
 * Başlatma: npm run worker veya PM2 ile run-worker.js.
 */
import { hasRedis } from './config/index.js';
import { connectDb, disconnectDb } from './db/index.js';
import { connectRedis, disconnectRedis } from './redis/index.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();
  logger.info('DB connected');

  if (!hasRedis()) {
    logger.info('REDIS_URL not set — analysis jobs run in API process. Worker idle.');
    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
    await new Promise<void>(() => {}); // süreci açık tut (PM2 için)
    return;
  }

  await connectRedis();
  logger.info('Redis connected');

  const { worker } = await import('./worker/analysis.worker.js');

  await new Promise<void>((resolve) => {
    worker.once('ready', () => {
      logger.info('Domain analysis worker ready — listening for jobs (SEO, stress, security)');
      resolve();
    });
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, closing worker…`);
    await worker.close();
    await disconnectRedis();
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
