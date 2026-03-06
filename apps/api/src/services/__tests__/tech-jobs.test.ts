import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Temiz store ile başlamak için modülü her test grubu öncesinde sıfırla
let createJob: typeof import('../tech-jobs.js').createJob;
let markRunning: typeof import('../tech-jobs.js').markRunning;
let appendLog: typeof import('../tech-jobs.js').appendLog;
let finishJob: typeof import('../tech-jobs.js').finishJob;
let getJob: typeof import('../tech-jobs.js').getJob;
let getServerJobs: typeof import('../tech-jobs.js').getServerJobs;
let jobEmitter: typeof import('../tech-jobs.js').jobEmitter;

beforeEach(async () => {
  // Her test için modülü yeniden yükle → temiz jobStore
  vi.resetModules();
  const mod = await import('../tech-jobs.js');
  createJob    = mod.createJob;
  markRunning  = mod.markRunning;
  appendLog    = mod.appendLog;
  finishJob    = mod.finishJob;
  getJob       = mod.getJob;
  getServerJobs = mod.getServerJobs;
  jobEmitter   = mod.jobEmitter;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jobParams = {
  serverId: 'server-1',
  techId:   'docker',
  techName: 'Docker',
  action:   'install' as const,
};

describe('createJob', () => {
  it('benzersiz id ile pending job oluşturmalı', () => {
    const job = createJob(jobParams);
    expect(job.id).toBeTruthy();
    expect(job.status).toBe('pending');
    expect(job.logs).toEqual([]);
    expect(job.startedAt).toBeInstanceOf(Date);
  });

  it('her çağrıda farklı id üretmeli', () => {
    const a = createJob(jobParams);
    const b = createJob(jobParams);
    expect(a.id).not.toBe(b.id);
  });

  it('oluşturulan job getJob ile alınabilmeli', () => {
    const job = createJob(jobParams);
    expect(getJob(job.id)).toBe(job);
  });
});

describe('markRunning', () => {
  it('job statusunu running yapmalı', () => {
    const job = createJob(jobParams);
    markRunning(job.id);
    expect(getJob(job.id)?.status).toBe('running');
  });

  it('olmayan job id\'si için hata fırlatmamalı', () => {
    expect(() => markRunning('nonexistent')).not.toThrow();
  });
});

describe('appendLog', () => {
  it('log satırı eklemeli', () => {
    const job = createJob(jobParams);
    appendLog(job.id, 'Adım 1');
    appendLog(job.id, 'Adım 2');
    expect(getJob(job.id)?.logs).toEqual(['Adım 1', 'Adım 2']);
  });

  it('log eklenince event emit etmeli', () => {
    const job = createJob(jobParams);
    const spy = vi.fn();
    jobEmitter.on(`job:${job.id}:log`, spy);
    appendLog(job.id, 'test log');
    expect(spy).toHaveBeenCalledWith('test log');
  });

  it('olmayan job id\'si için hata fırlatmamalı', () => {
    expect(() => appendLog('nonexistent', 'log')).not.toThrow();
  });
});

describe('finishJob', () => {
  it('success ile bitirmeli', () => {
    const job = createJob(jobParams);
    finishJob(job.id, 'success', 0);
    const stored = getJob(job.id)!;
    expect(stored.status).toBe('success');
    expect(stored.exitCode).toBe(0);
    expect(stored.finishedAt).toBeInstanceOf(Date);
  });

  it('failed ile bitirmeli', () => {
    const job = createJob(jobParams);
    finishJob(job.id, 'failed', 1);
    expect(getJob(job.id)?.status).toBe('failed');
    expect(getJob(job.id)?.exitCode).toBe(1);
  });

  it('done event emit etmeli', () => {
    const job = createJob(jobParams);
    const spy = vi.fn();
    jobEmitter.on(`job:${job.id}:done`, spy);
    finishJob(job.id, 'success', 0);
    expect(spy).toHaveBeenCalledWith({ status: 'success', exitCode: 0 });
  });
});

describe('getServerJobs', () => {
  it('sunucuya ait job\'ları döndürmeli', () => {
    createJob({ ...jobParams, serverId: 'server-A' });
    createJob({ ...jobParams, serverId: 'server-A' });
    createJob({ ...jobParams, serverId: 'server-B' });

    const jobs = getServerJobs('server-A');
    expect(jobs).toHaveLength(2);
    expect(jobs.every(j => j.serverId === 'server-A')).toBe(true);
  });

  it('en fazla 30 job döndürmeli', () => {
    for (let i = 0; i < 35; i++) {
      createJob({ ...jobParams, serverId: 'server-C' });
    }
    expect(getServerJobs('server-C')).toHaveLength(30);
  });

  it('olmayan sunucu için boş array döndürmeli', () => {
    expect(getServerJobs('nonexistent')).toEqual([]);
  });

  it('en yeni job önce gelmeli (desc sort)', () => {
    const a = createJob({ ...jobParams, serverId: 'server-D' });
    // biraz bekle ki startedAt farklı olsun
    const b = createJob({ ...jobParams, serverId: 'server-D' });
    b.startedAt = new Date(Date.now() + 1000);

    const jobs = getServerJobs('server-D');
    expect(jobs[0].id).toBe(b.id);
  });
});

describe('getJob', () => {
  it('olmayan job için undefined döndürmeli', () => {
    expect(getJob('nonexistent')).toBeUndefined();
  });
});
