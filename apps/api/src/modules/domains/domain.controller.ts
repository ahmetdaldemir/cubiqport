import { FastifyRequest, FastifyReply } from 'fastify';
import { DomainService } from './domain.service.js';
import { CreateDomainSchema, UpdateDomainSchema } from '@cubiqport/shared';
import { z } from 'zod';

const service = new DomainService();

export async function listDomains(
  req: FastifyRequest<{ Querystring: { serverId?: string } }>,
  reply: FastifyReply,
) {
  const domains = await service.listDomains(req.user.sub, req.query.serverId);
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

// ─── File Manager ─────────────────────────────────────────────────────────────

export async function listFiles(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { path?: string } }>,
  reply: FastifyReply,
) {
  const entries = await service.listFiles(req.params.id, req.user.sub, req.query.path ?? '');
  return reply.send({ success: true, data: entries });
}

export async function readFile(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { path: string } }>,
  reply: FastifyReply,
) {
  const content = await service.readFile(req.params.id, req.user.sub, req.query.path);
  return reply.send({ success: true, data: { content } });
}

export async function writeFile(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { path, content } = req.body as { path: string; content: string };
  await service.writeFile(req.params.id, req.user.sub, path, content);
  return reply.send({ success: true });
}

export async function deleteFile(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { path: string; recursive?: string } }>,
  reply: FastifyReply,
) {
  await service.deleteFile(req.params.id, req.user.sub, req.query.path, req.query.recursive === 'true');
  return reply.send({ success: true });
}

export async function mkdir(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { path } = req.body as { path: string };
  await service.mkdir(req.params.id, req.user.sub, path);
  return reply.send({ success: true });
}

// ─── Nginx config ─────────────────────────────────────────────────────────────

export async function getNginxConfig(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.getNginxConfig(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function updateNginxConfig(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { content } = (req.body as { content: string }) ?? {};
  if (typeof content !== 'string') {
    return reply.status(400).send({ success: false, error: 'content is required' });
  }
  const result = await service.updateNginxConfig(req.params.id, req.user.sub, content);
  return reply.send({ success: true, data: result });
}

// ─── GitHub / Deploy ──────────────────────────────────────────────────────────

export async function setGithub(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const body = z
    .object({
      githubRepo: z.string().url(),
      githubBranch: z.string().default('main'),
      deployCommand: z.string().optional(),
    })
    .parse(req.body);
  const result = await service.setGithub(req.params.id, req.user.sub, body);
  return reply.send({ success: true, data: result });
}

export async function deploy(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.deploy(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}

export async function githubWebhook(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { secret: string } }>,
  reply: FastifyReply,
) {
  const result = await service.handleWebhook(req.params.id, req.query.secret);
  return reply.send({ success: true, data: result });
}
