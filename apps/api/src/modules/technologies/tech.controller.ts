import { FastifyRequest, FastifyReply } from 'fastify';
import { TechService } from './tech.service.js';
import { getJob, jobEmitter } from '../../services/tech-jobs.js';

const service = new TechService();

export async function scanTechnologies(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    const data = await service.scanTechnologies(id, req.user.sub);
    return reply.send({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConnectionError = message.includes('SSH') || message.includes('connection') || message.includes('ECONNREFUSED') || message.includes('authentication');
    if (isConnectionError) {
      return reply.status(200).send({
        success: true,
        data: [],
        error: 'connection_failed',
        message: 'Sunucuya bağlanılamadı. SSH erişimini ve sunucu durumunu kontrol edin.',
      });
    }
    throw err;
  }
}

export async function installTechnology(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { techId, version, action } = req.body as {
    techId: string; version?: string; action?: 'install' | 'upgrade';
  };
  const jobId = await service.startInstall(id, techId, version, req.user.sub, action ?? 'install');
  return reply.status(202).send({ success: true, data: { jobId } });
}

export async function controlService(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { techId, action } = req.body as { techId: string; action: 'start' | 'stop' | 'restart' };
  const jobId = await service.controlService(id, techId, action, req.user.sub);
  return reply.send({ success: true, data: { jobId } });
}

export async function getJobStatus(req: FastifyRequest, reply: FastifyReply) {
  const { jobId } = req.params as { jobId: string };
  const job = service.getJob(jobId);
  if (!job) return reply.status(404).send({ success: false, error: 'Job bulunamadı' });
  return reply.send({ success: true, data: job });
}

export async function getServerJobs(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  return reply.send({ success: true, data: service.getServerJobs(id) });
}

/** SSE — kurulum loglarını gerçek zamanlı aktar */
export async function streamJobLogs(req: FastifyRequest, reply: FastifyReply) {
  const { jobId } = req.params as { jobId: string };
  const job = getJob(jobId);

  reply.raw.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  reply.raw.flushHeaders?.();

  const send = (data: unknown) =>
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

  if (!job) {
    send({ error: 'Job bulunamadı' });
    reply.raw.end();
    return reply;
  }

  // Önceki logları toplu gönder
  if (job.logs.length > 0) send({ log: job.logs.join('') });

  // Zaten bitmişse done gönder
  if (job.status === 'success' || job.status === 'failed') {
    send({ done: true, status: job.status });
    reply.raw.end();
    return reply;
  }

  const onLog  = (chunk: string) => send({ log: chunk });
  const onDone = ({ status }: { status: string }) => {
    send({ done: true, status });
    cleanup();
    reply.raw.end();
  };

  const cleanup = () => {
    jobEmitter.off(`job:${jobId}:log`,  onLog);
    jobEmitter.off(`job:${jobId}:done`, onDone);
  };

  jobEmitter.on(`job:${jobId}:log`,   onLog);
  jobEmitter.once(`job:${jobId}:done`, onDone);
  req.raw.on('close', cleanup);

  return reply;
}
