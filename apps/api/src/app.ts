import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { authPluginModule } from './plugins/auth.plugin.js';
import { AppError } from './utils/errors.js';

// ─── Route modules ────────────────────────────────────────────────────────────
import { authRoutes } from './modules/auth/auth.routes.js';
import { serverRoutes } from './modules/servers/server.routes.js';
import { domainRoutes } from './modules/domains/domain.routes.js';
import { analysisRoutes } from './modules/analysis/analysis.routes.js';
import { dnsRoutes } from './modules/dns/dns.routes.js';
import { deploymentRoutes } from './modules/deployments/deployment.routes.js';
import { monitoringRoutes } from './modules/monitoring/monitoring.routes.js';
import { billingRoutes } from './modules/billing/billing.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { maintenanceRoutes } from './modules/maintenance/maintenance.routes.js';
import { terminalRoutes } from './modules/terminal/terminal.routes.js';
import { testDatabaseRoutes } from './modules/test-databases/test-database.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger,
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
      },
    },
  });

  // ── Security ────────────────────────────────────────────────────────────────
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error: 'Too many requests, please slow down.',
    }),
  });

  // POST/PATCH with application/json + empty body → 400 önleme (test-connection vb.)
  app.addHook('preParsing', (request, _reply, payload, done) => {
    const ct = request.headers['content-type'];
    const cl = request.headers['content-length'];
    if (
      ['POST', 'PATCH', 'PUT'].includes(request.method) &&
      ct?.includes('application/json') &&
      (cl === '0' || (cl === undefined && !request.headers['transfer-encoding']))
    ) {
      delete request.headers['content-type'];
    }
    done(null, payload);
  });

  // ── Auth ────────────────────────────────────────────────────────────────────
  await app.register(authPluginModule);

  // ── WebSocket (terminal SSH proxy) ───────────────────────────────────────────
  await app.register(fastifyWebsocket, { options: { clientTracking: true } });

  // ── Swagger ─────────────────────────────────────────────────────────────────
  if (config.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'CubiqPort API', version: '1.0.0', description: 'Server orchestration API' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  // ── Global error handler ────────────────────────────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    // Fastify validation / content-type hataları → 4xx (500 yerine)
    const err = error as { validation?: unknown; name?: string; code?: string; statusCode?: number; message?: string };
    if (err.validation) {
      return reply.status(422).send({
        success: false,
        error: 'Validation failed',
        details: err.validation,
      });
    }
    if (err.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
      return reply.status(400).send({ success: false, error: err.message ?? 'Body cannot be empty' });
    }
    if (err.code === 'FST_ERR_NOT_FOUND') {
      return reply.status(404).send({ success: false, error: 'Not found' });
    }
    if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.status(err.statusCode).send({
        success: false,
        error: err.message ?? 'Request error',
      });
    }
    // Zod validation errors (controller parse çağrılarından) → 422
    if (error.name === 'ZodError' && 'issues' in error) {
      return reply.status(422).send({
        success: false,
        error: 'Validation failed',
        details: (error as unknown as { issues: unknown[] }).issues,
      });
    }
    app.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({ success: false, error: 'Internal server error' });
  });

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ── Route registration ──────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(serverRoutes, { prefix: '/api/v1/servers' });
  await app.register(domainRoutes, { prefix: '/api/v1/domains' });
  await app.register(analysisRoutes, { prefix: '/api/v1/domains' });
  await app.register(dnsRoutes, { prefix: '/api/v1/dns' });
  await app.register(deploymentRoutes, { prefix: '/api/v1/deployments' });
  await app.register(monitoringRoutes, { prefix: '/api/v1/monitoring' });
  await app.register(billingRoutes, { prefix: '/api/v1/billing' });
  await app.register(adminRoutes,   { prefix: '/api/v1/admin' });
  await app.register((await import('./modules/technologies/tech.routes.js')).techRoutes, { prefix: '/api/v1/servers' });
  await app.register(maintenanceRoutes, { prefix: '/api/v1/servers' });
  await app.register(terminalRoutes, { prefix: '/api/v1/servers' });
  await app.register(testDatabaseRoutes, { prefix: '/api/v1/databases' });

  return app;
}
