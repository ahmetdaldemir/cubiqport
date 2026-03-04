import { FastifyInstance } from 'fastify';
import {
  listDeployments,
  getDeployment,
  createDeployment,
  cancelDeployment,
} from './deployment.controller.js';

type IdParam = { Params: { id: string } };
type DomainQuery = { Querystring: { domainId: string } };

export async function deploymentRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get<DomainQuery>('/', auth, listDeployments);
  fastify.get<IdParam>('/:id', auth, getDeployment);
  fastify.post('/', auth, createDeployment);
  fastify.post<IdParam>('/:id/cancel', auth, cancelDeployment);
}
