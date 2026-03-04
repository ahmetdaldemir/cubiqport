import { FastifyInstance } from 'fastify';
import { listRecords, createRecord, deleteRecord } from './dns.controller.js';

type IdParam = { Params: { id: string } };
type DomainQuery = { Querystring: { domainId: string } };

export async function dnsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get<DomainQuery>('/', auth, listRecords);
  fastify.post('/', auth, createRecord);
  fastify.delete<IdParam>('/:id', auth, deleteRecord);
}
