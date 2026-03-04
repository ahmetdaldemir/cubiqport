import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { installSsl } from '../services/ssl.service.js';
import { AppError } from '../utils/errors.js';

const SslInstallSchema = z.object({
  domain: z.string().min(1),
  email: z.string().email(),
});

export async function sslRoutes(fastify: FastifyInstance) {
  fastify.post('/ssl/install', async (req, reply) => {
    const body = SslInstallSchema.parse(req.body);
    try {
      installSsl(body);
      return reply.send({ success: true });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });
}
