import { FastifyRequest, FastifyReply } from 'fastify';
import { DnsService } from './dns.service.js';
import { CreateDnsRecordSchema } from '@cubiqport/shared';

const service = new DnsService();

export async function listRecords(
  req: FastifyRequest<{ Querystring: { domainId: string } }>,
  reply: FastifyReply,
) {
  const records = await service.listRecords(req.query.domainId, req.user.sub);
  return reply.send({ success: true, data: records });
}

export async function createRecord(req: FastifyRequest, reply: FastifyReply) {
  const body = CreateDnsRecordSchema.parse(req.body);
  const record = await service.createRecord(req.user.sub, body);
  return reply.status(201).send({ success: true, data: record });
}

export async function deleteRecord(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await service.deleteRecord(req.params.id, req.user.sub);
  return reply.status(204).send();
}
