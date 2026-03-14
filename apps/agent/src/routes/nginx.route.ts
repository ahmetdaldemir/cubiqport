import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createNginxConfig, removeNginxConfig } from '../services/nginx.service.js';
import { AppError } from '../utils/errors.js';

const NginxCreateSchema = z.object({
  domain: z.string().min(1),
  port: z.number().int().positive(),
  rootPath: z.string().min(1),
  sslEnabled: z.boolean().optional().default(false),
});

const NginxRemoveSchema = z.object({
  domain: z.string().min(1),
});

export async function nginxRoutes(fastify: FastifyInstance) {
  fastify.post('/nginx/create', async (req, reply) => {
    const body = NginxCreateSchema.parse(req.body);
    try {
      const configPath = createNginxConfig(body);
      return reply.send({ success: true, data: { path: configPath } });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  fastify.post('/nginx/remove', async (req, reply) => {
    const body = NginxRemoveSchema.parse(req.body);
    try {
      removeNginxConfig(body.domain);
      return reply.send({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });
}
