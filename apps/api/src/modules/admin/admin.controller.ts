import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from './admin.service.js';

const service = new AdminService();

export async function getStats(_req: FastifyRequest, reply: FastifyReply) {
  const data = await service.getStats();
  return reply.send({ success: true, data });
}

export async function listUsers(_req: FastifyRequest, reply: FastifyReply) {
  const data = await service.listUsers();
  return reply.send({ success: true, data });
}

export async function getUserServers(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = req.params as { userId: string };
  const data = await service.getUserServers(userId);
  return reply.send({ success: true, data });
}

export async function getUserDomains(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = req.params as { userId: string };
  const data = await service.getUserDomains(userId);
  return reply.send({ success: true, data });
}

export async function listAllServers(_req: FastifyRequest, reply: FastifyReply) {
  const data = await service.listAllServers();
  return reply.send({ success: true, data });
}

export async function listAllDomains(_req: FastifyRequest, reply: FastifyReply) {
  const data = await service.listAllDomains();
  return reply.send({ success: true, data });
}

export async function listWebhookEvents(req: FastifyRequest, reply: FastifyReply) {
  const { limit } = req.query as { limit?: string };
  const data = await service.listWebhookEvents(limit ? parseInt(limit) : 100);
  return reply.send({ success: true, data });
}

export async function getWebhookEvent(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const data = await service.getWebhookEvent(id);
  if (!data) return reply.status(404).send({ success: false, error: 'Event bulunamadı' });
  return reply.send({ success: true, data });
}

export async function createUser(req: FastifyRequest, reply: FastifyReply) {
  const { email, password } = req.body as { email: string; password?: string };
  if (!email) return reply.status(400).send({ success: false, error: 'E-posta zorunlu' });
  const data = await service.createUser(email, password);
  return reply.status(201).send({ success: true, data: { userId: data.user.id, email: data.user.email } });
}

export async function suspendUser(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = req.params as { userId: string };
  const { reason } = (req.body as { reason?: string }) ?? {};
  const data = await service.suspendUser(userId, reason);
  return reply.send({ success: true, data });
}

export async function unsuspendUser(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = req.params as { userId: string };
  const data = await service.unsuspendUser(userId);
  return reply.send({ success: true, data });
}
