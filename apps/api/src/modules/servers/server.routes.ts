import { FastifyInstance } from 'fastify';
import {
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  testConnection,
  provisionServer,
  pingAgent,
  rebootServer,
  shutdownServer,
  reinstallStack,
  scanDomains,
  scanServer,
  listContainers,
  getContainerLogs,
  restartContainer,
  stopContainer,
  deleteContainer,
} from './server.controller.js';

type IdParam = { Params: { id: string } };
type ReinstallParam = { Params: { id: string }; Body: { confirm: string } };
type ContainerParam = { Params: { id: string; name: string } };
type ContainerLogsParam = { Params: { id: string; name: string }; Querystring: { lines?: string } };

export async function serverRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get('/', auth, listServers);
  fastify.get<IdParam>('/:id', auth, getServer);
  fastify.post('/', auth, createServer);
  fastify.patch<IdParam>('/:id', auth, updateServer);
  fastify.delete<IdParam>('/:id', auth, deleteServer);

  // SSH / agent actions
  fastify.post<IdParam>('/:id/test-connection', auth, testConnection);
  fastify.post<IdParam>('/:id/provision', auth, provisionServer);
  fastify.get<IdParam>('/:id/agent/ping', auth, pingAgent);

  // Power & maintenance actions
  fastify.post<IdParam>('/:id/reboot', auth, rebootServer);
  fastify.post<IdParam>('/:id/shutdown', auth, shutdownServer);
  fastify.post<ReinstallParam>('/:id/reinstall-stack', auth, reinstallStack);
  fastify.post<IdParam>('/:id/scan-domains', auth, scanDomains);
  fastify.post<IdParam>('/:id/scan', auth, scanServer);

  // Docker container management
  fastify.get<IdParam>('/:id/containers', auth, listContainers);
  fastify.get<ContainerLogsParam>('/:id/containers/:name/logs', auth, getContainerLogs);
  fastify.post<ContainerParam>('/:id/containers/:name/restart', auth, restartContainer);
  fastify.post<ContainerParam>('/:id/containers/:name/stop', auth, stopContainer);
  fastify.delete<ContainerParam>('/:id/containers/:name', auth, deleteContainer);
}
