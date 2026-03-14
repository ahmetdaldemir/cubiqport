/**
 * Domain analysis worker — Redis kaldırıldı; analiz işleri API sürecinde inline çalışır.
 * Bu süreç artık sadece PM2 uyumluluğu için açık kalır (boşta).
 * İsterseniz ecosystem'den kaldırabilirsiniz.
 */
import { connectDb, disconnectDb } from './db/index.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();
  logger.info('DB connected — analysis jobs run inline in API process. Worker idle.');

  process.on('SIGTERM', async () => {
    await disconnectDb();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await disconnectDb();
    process.exit(0);
  });

  await new Promise<void>(() => {}); // süreci açık tut (PM2 için)
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
