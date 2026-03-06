import { FastifyInstance } from 'fastify';
import { register, login, me } from './auth.controller.js';

const credentialSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email:    { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const;

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', { schema: { body: credentialSchema } }, register);
  fastify.post('/login',    { schema: { body: credentialSchema } }, login);
  fastify.get('/me', { preHandler: [fastify.authenticate] }, me);
}
