import { FastifyRequest, FastifyReply } from 'fastify';
import { MaintenanceService } from './maintenance.service.js';
import { AppError } from '../../utils/errors.js';
import { getJob, jobEmitter } from '../../services/tech-jobs.js';

const svc = new MaintenanceService();

// ─── Analiz endpoint'leri ────────────────────────────────────────────────────

export async function getOverview(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const data = await svc.getOverview(id, req.user.sub);
  return reply.send({ success: true, data });
}

export async function analyzeLogs(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const data = await svc.analyzeLogs(id, req.user.sub);
  return reply.send({ success: true, data });
}

export async function analyzeDocker(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const data = await svc.analyzeDocker(id, req.user.sub);
  return reply.send({ success: true, data });
}

export async function analyzeLargeFiles(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { minSizeMB } = req.query as { minSizeMB?: string };
  const data = await svc.analyzeLargeFiles(id, req.user.sub, parseInt(minSizeMB ?? '100', 10));
  return reply.send({ success: true, data });
}

// ─── Aksiyon endpoint'leri (job döndürür) ────────────────────────────────────

export async function cleanLogs(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const jobId = await svc.cleanLogs(id, req.user.sub);
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function cleanDocker(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as {
    containers?: string[];
    volumes?: string[];
    images?: string[];
    pruneAll?: boolean;
  };
  const jobId = await svc.cleanDocker(id, req.user.sub, body);
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function deleteFiles(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { paths } = req.body as { paths: string[] };
  if (!Array.isArray(paths) || !paths.length) {
    throw new AppError('Silinecek dosya listesi boş olamaz', 400);
  }
  const jobId = await svc.deleteFiles(id, req.user.sub, paths);
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function runMalwareScan(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const jobId = await svc.runMalwareScan(id, req.user.sub);
  return reply.status(202).send({ success: true, data: { jobId } });
}

// ─── Job status / SSE stream ──────────────────────────────────────────────────

export async function getJobStatus(req: FastifyRequest, reply: FastifyReply) {
  const { jobId } = req.params as { jobId: string };
  const job = getJob(jobId);
  if (!job) throw new AppError('Job bulunamadı', 404);
  return reply.send({ success: true, data: job });
}

export async function streamJobLogs(req: FastifyRequest, reply: FastifyReply) {
  const { jobId } = req.params as { jobId: string };
  const job = getJob(jobId);
  if (!job) {
    return reply.status(404).send({ success: false, error: 'Job bulunamadı' });
  }

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();

  const send = (data: object) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  for (const line of job.logs) {
    send({ type: 'log', line });
  }

  if (job.status === 'success' || job.status === 'failed') {
    send({ type: 'done', status: job.status, exitCode: job.exitCode });
    reply.raw.end();
    return;
  }

  const onLog  = (line: string) => send({ type: 'log', line });
  const onDone = (result: { status: string; exitCode?: number }) => {
    send({ type: 'done', ...result });
    reply.raw.end();
    cleanup();
  };

  const cleanup = () => {
    jobEmitter.off(`job:${jobId}:log`, onLog);
    jobEmitter.off(`job:${jobId}:done`, onDone);
  };

  jobEmitter.on(`job:${jobId}:log`, onLog);
  jobEmitter.on(`job:${jobId}:done`, onDone);

  req.socket.on('close', cleanup);
}
