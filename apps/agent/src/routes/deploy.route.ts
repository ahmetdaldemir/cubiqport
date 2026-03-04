import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deployApp } from '../services/docker.service.js';
import { AppError } from '../utils/errors.js';

const DeploySchema = z.object({
  domainId: z.string().min(1),
  repository: z.string().url(),
  branch: z.string().default('main'),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  rootPath: z.string().min(1),
  port: z.number().int().positive(),
  envVars: z.record(z.string()).optional(),
});

export async function deployRoutes(fastify: FastifyInstance) {
  fastify.post('/deploy', async (req, reply) => {
    const body = DeploySchema.parse(req.body);
    try {
      const jobId = deployApp(body);
      return reply.status(202).send({ success: true, data: { jobId } });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });
}
