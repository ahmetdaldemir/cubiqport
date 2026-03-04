import { buildApp } from './app.js';
import { config } from './config/index.js';
import { connectDb, disconnectDb } from './db/index.js';
import { connectRedis, disconnectRedis } from './redis/index.js';
import { logger } from './utils/logger.js';
import { startMetricsPoller, stopMetricsPoller } from './services/metrics-poller.service.js';

async function main() {
  await connectDb();
  await connectRedis();

  const app = await buildApp();

  const address = await app.listen({ port: config.API_PORT, host: config.API_HOST });
  logger.info(`CubiqPort API listening at ${address}`);

  // Start polling agent metrics in the background
  if (config.NODE_ENV !== 'test') {
    startMetricsPoller();
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down…`);
    stopMetricsPoller();
    await app.close();
    await disconnectDb();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
