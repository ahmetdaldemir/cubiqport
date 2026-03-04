import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLiveMetrics, getHistoricalMetrics, ingestMetrics } from './monitoring.controller.js';
import { config } from '../../config/index.js';

type ServerIdParam = { Params: { serverId: string } };
type HistoryQuery = { Params: { serverId: string }; Querystring: { hours?: string } };

async function agentAuth(req: FastifyRequest, reply: FastifyReply) {
  const secret = req.headers['x-agent-secret'];
  if (secret !== config.AGENT_SECRET) {
    reply.status(401).send({ success: false, error: 'Invalid agent secret' });
  }
}

export async function monitoringRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const agentAuthHook = { preHandler: [agentAuth] };

  fastify.get<ServerIdParam>('/servers/:serverId/live', auth, getLiveMetrics);
  fastify.get<HistoryQuery>('/servers/:serverId/history', auth, getHistoricalMetrics);

  // Agent push endpoint — no JWT, uses shared AGENT_SECRET
  fastify.post<ServerIdParam>('/servers/:serverId/ingest', agentAuthHook, ingestMetrics);
}
