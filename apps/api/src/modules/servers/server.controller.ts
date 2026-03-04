import { FastifyRequest, FastifyReply } from 'fastify';
import { ServerService } from './server.service.js';
import { CreateServerSchema, UpdateServerSchema } from '@cubiqport/shared';

const service = new ServerService();

export async function listServers(req: FastifyRequest, reply: FastifyReply) {
  const servers = await service.listServers(req.user.sub);
  return reply.send({ success: true, data: servers });
}

export async function getServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const server = await service.getServer(req.params.id, req.user.sub);
  return reply.send({ success: true, data: server });
}

export async function createServer(req: FastifyRequest, reply: FastifyReply) {
  const body = CreateServerSchema.parse(req.body);
  const server = await service.createServer(req.user.sub, body);
  return reply.status(201).send({ success: true, data: server });
}

export async function updateServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const body = UpdateServerSchema.parse(req.body);
  const server = await service.updateServer(req.params.id, req.user.sub, body);
  return reply.send({ success: true, data: server });
}

export async function deleteServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await service.deleteServer(req.params.id, req.user.sub);
  return reply.status(204).send();
}

export async function testConnection(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.testConnection(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function provisionServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.provisionServer(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function pingAgent(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.pingAgent(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}
