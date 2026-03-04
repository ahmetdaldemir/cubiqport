import { FastifyInstance } from 'fastify';
import {
  listDomains,
  getDomain,
  createDomain,
  updateDomain,
  deleteDomain,
  enableSsl,
} from './domain.controller.js';

type IdParam = { Params: { id: string } };

export async function domainRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get('/', auth, listDomains);
  fastify.get<IdParam>('/:id', auth, getDomain);
  fastify.post('/', auth, createDomain);
  fastify.patch<IdParam>('/:id', auth, updateDomain);
  fastify.delete<IdParam>('/:id', auth, deleteDomain);
  fastify.post<IdParam>('/:id/ssl', auth, enableSsl);
}
