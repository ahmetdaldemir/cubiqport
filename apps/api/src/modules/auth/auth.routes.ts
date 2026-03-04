import { FastifyInstance } from 'fastify';
import { register, login, me } from './auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', register);
  fastify.post('/login', login);
  fastify.get('/me', { preHandler: [fastify.authenticate] }, me);
}
