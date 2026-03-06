import { FastifyInstance } from 'fastify';
import {
  getOverview,
  analyzeLogs,
  analyzeDocker,
  analyzeLargeFiles,
  cleanLogs,
  cleanDocker,
  deleteFiles,
  runMalwareScan,
  getJobStatus,
  streamJobLogs,
} from './maintenance.controller.js';

const dockerCleanSchema = {
  type: 'object',
  properties: {
    containers: { type: 'array', items: { type: 'string' } },
    volumes:    { type: 'array', items: { type: 'string' } },
    images:     { type: 'array', items: { type: 'string' } },
    pruneAll:   { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const deleteFilesSchema = {
  type: 'object',
  required: ['paths'],
  properties: {
    paths: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
  additionalProperties: false,
} as const;

// Body olmayan POST route'ları için boş schema — Fastify boş JSON body hatasını önler
const emptyBodySchema = { type: 'object', additionalProperties: true } as const;

export async function maintenanceRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  // ── Analiz
  fastify.get('/:id/maintenance/overview',    auth, getOverview);
  fastify.get('/:id/maintenance/logs',        auth, analyzeLogs);
  fastify.get('/:id/maintenance/docker',      auth, analyzeDocker);
  fastify.get('/:id/maintenance/files',       auth, analyzeLargeFiles);

  // ── Aksiyonlar (job başlatır → 202)
  fastify.post('/:id/maintenance/logs/clean',   { ...auth, schema: { body: emptyBodySchema } }, cleanLogs);
  fastify.post('/:id/maintenance/docker/clean', { ...auth, schema: { body: dockerCleanSchema } }, cleanDocker);
  fastify.post('/:id/maintenance/files/delete', { ...auth, schema: { body: deleteFilesSchema } }, deleteFiles);
  fastify.post('/:id/maintenance/malware-scan', { ...auth, schema: { body: emptyBodySchema } }, runMalwareScan);

  // ── Job takibi & SSE
  fastify.get('/:id/maintenance/jobs/:jobId',          auth, getJobStatus);
  fastify.get('/:id/maintenance/jobs/:jobId/stream',   auth, streamJobLogs);
}
