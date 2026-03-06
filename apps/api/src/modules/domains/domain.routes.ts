import { FastifyInstance } from 'fastify';
import {
  listDomains,
  getDomain,
  createDomain,
  updateDomain,
  deleteDomain,
  enableSsl,
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  mkdir,
  setGithub,
  deploy,
  githubWebhook,
} from './domain.controller.js';

type IdParam = { Params: { id: string } };
type ListQuery = { Querystring: { serverId?: string } };
type FileQuery = { Querystring: { path: string; recursive?: string } };
type FileBrowseQuery = { Querystring: { path?: string } };

export async function domainRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get<ListQuery>('/', auth, listDomains);
  fastify.get<IdParam>('/:id', auth, getDomain);
  fastify.post('/', auth, createDomain);
  fastify.patch<IdParam>('/:id', auth, updateDomain);
  fastify.delete<IdParam>('/:id', auth, deleteDomain);
  fastify.post<IdParam>('/:id/ssl', auth, enableSsl);

  // File manager
  fastify.get<IdParam & FileBrowseQuery>('/:id/files', auth, listFiles);
  fastify.get<IdParam & FileQuery>('/:id/files/read', auth, readFile);
  fastify.put<IdParam>('/:id/files/write', auth, writeFile);
  fastify.delete<IdParam & FileQuery>('/:id/files', auth, deleteFile);
  fastify.post<IdParam>('/:id/files/mkdir', auth, mkdir);

  // GitHub / deploy
  fastify.post<IdParam>('/:id/github', auth, setGithub);
  fastify.post<IdParam>('/:id/deploy', auth, deploy);

  // Public webhook endpoint (no auth — uses secret in query)
  fastify.post<IdParam & { Querystring: { secret: string } }>(
    '/:id/webhook',
    githubWebhook,
  );
}
