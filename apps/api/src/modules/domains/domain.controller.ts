import { FastifyRequest, FastifyReply } from 'fastify';
import { DomainService } from './domain.service.js';
import { CreateDomainSchema, UpdateDomainSchema } from '@cubiqport/shared';
import { z } from 'zod';

const service = new DomainService();

export async function listDomains(req: FastifyRequest, reply: FastifyReply) {
  const domains = await service.listDomains(req.user.sub);
  return reply.send({ success: true, data: domains });
}

export async function getDomain(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const domain = await service.getDomain(req.params.id, req.user.sub);
  return reply.send({ success: true, data: domain });
}

export async function createDomain(req: FastifyRequest, reply: FastifyReply) {
  const body = CreateDomainSchema.parse(req.body);
  const domain = await service.createDomain(req.user.sub, body);
  return reply.status(201).send({ success: true, data: domain });
}

export async function updateDomain(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const body = UpdateDomainSchema.parse(req.body);
  const domain = await service.updateDomain(req.params.id, req.user.sub, body);
  return reply.send({ success: true, data: domain });
}

export async function deleteDomain(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await service.deleteDomain(req.params.id, req.user.sub);
  return reply.status(204).send();
}

export async function enableSsl(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const result = await service.enableSsl(req.params.id, req.user.sub, email);
  return reply.send({ success: true, data: result });
}
