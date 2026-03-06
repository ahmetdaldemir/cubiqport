import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getStats,
  listUsers,
  getUserServers,
  getUserDomains,
  listAllServers,
  listAllDomains,
  listWebhookEvents,
  getWebhookEvent,
  createUser,
  suspendUser,
  unsuspendUser,
} from './admin.controller.js';
async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
  if ((req.user?.role as string) !== 'superadmin') {
    return reply.status(403).send({ success: false, error: 'Superadmin yetkisi gerekli', code: 'FORBIDDEN' });
  }
}

const createUserBodySchema = {
  type: 'object',
  required: ['email'],
  properties: {
    email:    { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
  },
  additionalProperties: false,
} as const;

const suspendBodySchema = {
  type: 'object',
  properties: {
    reason: { type: 'string', maxLength: 500 },
  },
  additionalProperties: false,
} as const;

export async function adminRoutes(fastify: FastifyInstance) {
  const auth      = { preHandler: [fastify.authenticate] };
  const superAuth = { preHandler: [fastify.authenticate, requireSuperAdmin] };

  fastify.get('/stats',                        superAuth, getStats);
  fastify.get('/users',                        superAuth, listUsers);
  fastify.post('/users',                       { ...superAuth, schema: { body: createUserBodySchema } }, createUser);
  fastify.get('/users/:userId/servers',        superAuth, getUserServers);
  fastify.get('/users/:userId/domains',        superAuth, getUserDomains);
  fastify.post('/users/:userId/suspend',       { ...superAuth, schema: { body: suspendBodySchema } }, suspendUser);
  fastify.post('/users/:userId/unsuspend',     superAuth, unsuspendUser);
  fastify.get('/servers',                      superAuth, listAllServers);
  fastify.get('/domains',                      superAuth, listAllDomains);
  fastify.get('/webhooks',                     superAuth, listWebhookEvents);
  fastify.get('/webhooks/:id',                 superAuth, getWebhookEvent);
}
