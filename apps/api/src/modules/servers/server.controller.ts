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

export async function rebootServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.rebootServer(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function shutdownServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.shutdownServer(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function reinstallStack(
  req: FastifyRequest<{ Params: { id: string }; Body: { confirm: string } }>,
  reply: FastifyReply,
) {
  const { confirm } = req.body as { confirm: string };
  const result = await service.reinstallStack(req.params.id, req.user.sub, confirm);
  return reply.send({ success: true, data: result });
}

export async function scanDomains(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.scanAndImportDomains(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function scanServer(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.scanServerAction(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

// ─── Docker Container Management ─────────────────────────────────────────────

export async function listContainers(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await service.listContainers(req.params.id, req.user.sub);
    return reply.send({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnectionError = msg.includes('SSH') || msg.includes('connection') || msg.includes('ECONNREFUSED') || msg.includes('authentication');
    if (isConnectionError) {
      return reply.send({ success: true, data: [] });
    }
    throw err;
  }
}

export async function getContainerLogs(
  req: FastifyRequest<{ Params: { id: string; name: string }; Querystring: { lines?: string } }>,
  reply: FastifyReply,
) {
  const lines = Number(req.query.lines ?? 100);
  const result = await service.getContainerLogs(req.params.id, req.user.sub, req.params.name, lines);
  return reply.send({ success: true, data: result });
}

export async function restartContainer(
  req: FastifyRequest<{ Params: { id: string; name: string } }>,
  reply: FastifyReply,
) {
  await service.containerAction(req.params.id, req.user.sub, req.params.name, 'restart');
  return reply.send({ success: true });
}

export async function stopContainer(
  req: FastifyRequest<{ Params: { id: string; name: string } }>,
  reply: FastifyReply,
) {
  await service.containerAction(req.params.id, req.user.sub, req.params.name, 'stop');
  return reply.send({ success: true });
}

export async function deleteContainer(
  req: FastifyRequest<{ Params: { id: string; name: string } }>,
  reply: FastifyReply,
) {
  await service.containerAction(req.params.id, req.user.sub, req.params.name, 'remove');
  return reply.send({ success: true });
}
