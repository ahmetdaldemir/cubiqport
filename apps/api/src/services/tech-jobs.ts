import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export type JobStatus = 'pending' | 'running' | 'success' | 'failed';
export type JobAction  = 'install' | 'upgrade' | 'service';

export interface InstallJob {
  id: string;
  serverId: string;
  techId: string;
  techName: string;
  version?: string;
  action: JobAction;
  status: JobStatus;
  logs: string[];
  startedAt: Date;
  finishedAt?: Date;
  exitCode?: number;
}

export const jobEmitter = new EventEmitter();
jobEmitter.setMaxListeners(200);

const jobStore = new Map<string, InstallJob>();

/** Tamamlanmış job'ları saklama süresi (ms) */
const JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 saat

/** Tamamlanmış job'ları belirli aralıklarla temizle — bellek sızıntısını önle */
function startGarbageCollector(intervalMs = 10 * 60 * 1000): void {
  setInterval(() => {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of jobStore) {
      if (job.finishedAt && job.finishedAt.getTime() < cutoff) {
        jobStore.delete(id);
        // Tüm listener'ları temizle
        jobEmitter.removeAllListeners(`job:${id}:log`);
        jobEmitter.removeAllListeners(`job:${id}:done`);
      }
    }
  }, intervalMs).unref(); // Süreci process exit'ten alıkoyma
}

startGarbageCollector();

export function createJob(params: Omit<InstallJob, 'id' | 'status' | 'logs' | 'startedAt'>): InstallJob {
  const job: InstallJob = { id: randomUUID(), status: 'pending', logs: [], startedAt: new Date(), ...params };
  jobStore.set(job.id, job);
  return job;
}

export function markRunning(jobId: string) {
  const job = jobStore.get(jobId);
  if (job) job.status = 'running';
}

export function appendLog(jobId: string, chunk: string) {
  const job = jobStore.get(jobId);
  if (!job) return;
  job.logs.push(chunk);
  jobEmitter.emit(`job:${jobId}:log`, chunk);
}

export function finishJob(jobId: string, status: 'success' | 'failed', exitCode?: number) {
  const job = jobStore.get(jobId);
  if (!job) return;
  job.status = status;
  job.finishedAt = new Date();
  job.exitCode = exitCode;
  jobEmitter.emit(`job:${jobId}:done`, { status, exitCode });
}

export function getJob(jobId: string): InstallJob | undefined {
  return jobStore.get(jobId);
}

export function getServerJobs(serverId: string): InstallJob[] {
  return Array.from(jobStore.values())
    .filter(j => j.serverId === serverId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 30);
}
