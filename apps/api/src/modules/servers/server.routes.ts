import { FastifyInstance } from 'fastify';
import {
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  testConnection,
  provisionServer,
  pingAgent,
} from './server.controller.js';

type IdParam = { Params: { id: string } };

export async function serverRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get('/', auth, listServers);
  fastify.get<IdParam>('/:id', auth, getServer);
  fastify.post('/', auth, createServer);
  fastify.patch<IdParam>('/:id', auth, updateServer);
  fastify.delete<IdParam>('/:id', auth, deleteServer);

  fastify.post<IdParam>('/:id/test-connection', auth, testConnection);
  fastify.post<IdParam>('/:id/provision', auth, provisionServer);
  fastify.get<IdParam>('/:id/agent/ping', auth, pingAgent);
}
