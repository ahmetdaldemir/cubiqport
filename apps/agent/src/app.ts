import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { metricsRoutes } from './routes/metrics.route.js';
import { nginxRoutes } from './routes/nginx.route.js';
import { sslRoutes } from './routes/ssl.route.js';
import { deployRoutes } from './routes/deploy.route.js';

const AGENT_SECRET = process.env.AGENT_SECRET ?? '';

export async function buildAgent() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(helmet, { global: true });

  // ── Secret middleware ───────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    // Allow health check without auth
    if (req.url === '/health') return;

    const secret = req.headers['x-agent-secret'];
    if (!AGENT_SECRET || secret !== AGENT_SECRET) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // ── Routes ──────────────────────────────────────────────────────────────────
  await app.register(metricsRoutes);
  await app.register(nginxRoutes);
  await app.register(sslRoutes);
  await app.register(deployRoutes);

  // ── Global error handler ────────────────────────────────────────────────────
  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err }, 'Unhandled agent error');
    reply.status(500).send({ success: false, error: err.message });
  });

  return app;
}
