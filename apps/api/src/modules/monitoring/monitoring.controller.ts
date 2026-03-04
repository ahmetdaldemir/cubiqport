import { FastifyRequest, FastifyReply } from 'fastify';
import { MonitoringService } from './monitoring.service.js';
import { z } from 'zod';

const service = new MonitoringService();

export async function getLiveMetrics(
  req: FastifyRequest<{ Params: { serverId: string } }>,
  reply: FastifyReply,
) {
  const metrics = await service.getLiveMetrics(req.params.serverId, req.user.sub);
  return reply.send({ success: true, data: metrics });
}

export async function getHistoricalMetrics(
  req: FastifyRequest<{ Params: { serverId: string }; Querystring: { hours?: string } }>,
  reply: FastifyReply,
) {
  const hours = z.coerce.number().min(1).max(168).default(24).parse(req.query.hours ?? '24');
  const data = await service.getHistoricalMetrics(req.params.serverId, req.user.sub, hours);
  return reply.send({ success: true, data });
}

/**
 * Agent pushes metrics here every ~10 seconds.
 * Protected by the shared AGENT_SECRET header.
 */
export async function ingestMetrics(
  req: FastifyRequest<{ Params: { serverId: string } }>,
  reply: FastifyReply,
) {
  const body = req.body as Parameters<MonitoringService['storeMetrics']>[1];
  await service.storeMetrics(req.params.serverId, body);
  return reply.status(204).send();
}
