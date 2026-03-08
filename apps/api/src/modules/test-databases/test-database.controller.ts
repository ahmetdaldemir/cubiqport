import { FastifyRequest, FastifyReply } from 'fastify';
import { TestDatabaseService } from './test-database.service.js';
import { CreateTestDatabaseSchema } from '@cubiqport/shared';

const service = new TestDatabaseService();

type IdParam = { Params: { id: string } };

export async function listTestDatabases(req: FastifyRequest, reply: FastifyReply) {
  const data = await service.list(req.user!.sub);
  return reply.send({ success: true, data });
}

export async function getTestDatabase(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const data = await service.get(req.params.id, req.user!.sub);
  return reply.send({ success: true, data });
}

export async function createTestDatabase(req: FastifyRequest, reply: FastifyReply) {
  const body = CreateTestDatabaseSchema.parse(req.body);
  const data = await service.create(req.user!.sub, body);
  return reply.status(201).send({ success: true, data });
}

export async function deleteTestDatabase(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  await service.delete(req.params.id, req.user!.sub);
  return reply.status(204).send();
}

export async function restartTestDatabase(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const data = await service.restart(req.params.id, req.user!.sub);
  return reply.send({ success: true, data });
}

export async function resetTestDatabasePassword(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const data = await service.resetPassword(req.params.id, req.user!.sub);
  return reply.send({ success: true, data });
}

export async function getTestDatabaseConnection(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const data = await service.getConnectionDetails(req.params.id, req.user!.sub);
  return reply.send({ success: true, data });
}
