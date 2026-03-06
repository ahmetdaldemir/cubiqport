import { FastifyInstance } from 'fastify';
import {
  scanTechnologies,
  installTechnology,
  controlService,
  getJobStatus,
  getServerJobs,
  streamJobLogs,
} from './tech.controller.js';

const installBodySchema = {
  type: 'object',
  required: ['techId'],
  properties: {
    techId:   { type: 'string', minLength: 1 },
    version:  { type: 'string' },
  },
  additionalProperties: false,
} as const;

const serviceBodySchema = {
  type: 'object',
  required: ['techId', 'action'],
  properties: {
    techId:  { type: 'string', minLength: 1 },
    action:  { type: 'string', enum: ['start', 'stop', 'restart'] },
  },
  additionalProperties: false,
} as const;

export async function techRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get('/:id/technologies',                    auth, scanTechnologies);
  fastify.post('/:id/technologies/install',           { ...auth, schema: { body: installBodySchema } }, installTechnology);
  fastify.post('/:id/technologies/service',           { ...auth, schema: { body: serviceBodySchema } }, controlService);
  fastify.get('/:id/technologies/jobs',               auth, getServerJobs);
  fastify.get('/:id/technologies/jobs/:jobId',        auth, getJobStatus);
  fastify.get('/:id/technologies/jobs/:jobId/stream', auth, streamJobLogs);
}
