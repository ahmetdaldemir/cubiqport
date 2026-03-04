import { FastifyRequest, FastifyReply } from 'fastify';
import { DeploymentService } from './deployment.service.js';
import { CreateDeploymentSchema } from '@cubiqport/shared';

const service = new DeploymentService();

export async function listDeployments(
  req: FastifyRequest<{ Querystring: { domainId: string } }>,
  reply: FastifyReply,
) {
  const deployments = await service.listDeployments(req.query.domainId, req.user.sub);
  return reply.send({ success: true, data: deployments });
}

export async function getDeployment(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const deployment = await service.getDeployment(req.params.id);
  return reply.send({ success: true, data: deployment });
}

export async function createDeployment(req: FastifyRequest, reply: FastifyReply) {
  const body = CreateDeploymentSchema.parse(req.body);
  const deployment = await service.createDeployment(req.user.sub, body);
  return reply.status(201).send({ success: true, data: deployment });
}

export async function cancelDeployment(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await service.cancelDeployment(req.params.id, req.user.sub);
  return reply.send({ success: true, data: result });
}
