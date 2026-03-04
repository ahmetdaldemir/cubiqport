import { buildAgent } from './app.js';
import { collectMetrics } from './services/metrics.service.js';
import { METRICS_INTERVAL_MS } from './constants.js';

const PORT = Number(process.env.AGENT_PORT ?? 9000);
const API_URL = process.env.CUBIQ_API_URL ?? '';
const SERVER_ID = process.env.CUBIQ_SERVER_ID ?? '';
const AGENT_SECRET = process.env.AGENT_SECRET ?? '';

async function main() {
  const app = await buildAgent();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`CubiqPort Agent listening on port ${PORT}`);

  // ── Metrics push loop ───────────────────────────────────────────────────────
  if (API_URL && SERVER_ID) {
    app.log.info('Starting metrics push loop');
    setInterval(async () => {
      try {
        const metrics = collectMetrics();
        await fetch(`${API_URL}/api/v1/monitoring/servers/${SERVER_ID}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Secret': AGENT_SECRET },
          body: JSON.stringify(metrics),
        });
      } catch (err) {
        app.log.warn({ err }, 'Failed to push metrics');
      }
    }, METRICS_INTERVAL_MS);
  } else {
    app.log.warn(
      'CUBIQ_API_URL or CUBIQ_SERVER_ID not set — metrics push disabled (pull mode only)',
    );
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down…`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal agent error:', err);
  process.exit(1);
});
