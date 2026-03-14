import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ServerDbConnectionService } from './server-db-connection.service.js';

const service = new ServerDbConnectionService();

const CreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['mysql', 'postgres']),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
});

type IdParam = { Params: { id: string } };
type ConnIdParam = { Params: { id: string; connectionId: string } };
type DbNameParam = { Params: { id: string; connectionId: string; dbName: string } };

export async function listConnections(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const data = await service.list(req.params.id, req.user!.sub);
  return reply.send({ success: true, data });
}

export async function createConnection(
  req: FastifyRequest<IdParam>,
  reply: FastifyReply,
) {
  const body = CreateBodySchema.parse(req.body);
  const data = await service.create(req.params.id, req.user!.sub, body);
  return reply.status(201).send({ success: true, data });
}

export async function deleteConnection(
  req: FastifyRequest<ConnIdParam>,
  reply: FastifyReply,
) {
  await service.delete(req.params.connectionId, req.user!.sub);
  return reply.status(204).send();
}

export async function listDatabases(
  req: FastifyRequest<ConnIdParam>,
  reply: FastifyReply,
) {
  const data = await service.listDatabases(
    req.params.id,
    req.params.connectionId,
    req.user!.sub,
  );
  return reply.send({ success: true, data });
}

export async function listTables(
  req: FastifyRequest<DbNameParam>,
  reply: FastifyReply,
) {
  const data = await service.listTables(
    req.params.id,
    req.params.connectionId,
    req.params.dbName,
    req.user!.sub,
  );
  return reply.send({ success: true, data });
}
