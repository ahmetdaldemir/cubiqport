import { FastifyInstance } from 'fastify';
import { collectMetrics } from '../services/metrics.service.js';

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics', async (_req, reply) => {
    const data = collectMetrics();
    return reply.send(data);
  });
}
