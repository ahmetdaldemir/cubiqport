'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TechStatus } from '@cubiqport/shared';

type Category = 'all' | 'container' | 'database' | 'runtime' | 'web' | 'messaging' | 'cache' | 'orchestration' | 'other';

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'Tümü', container: 'Container', database: 'Veritabanı',
  runtime: 'Runtime', web: 'Web Sunucu', messaging: 'Mesajlaşma',
  cache: 'Cache', orchestration: 'Orchestration', other: 'Diğer',
};

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function TechnologiesPage() {
  const { id: serverId } = useParams<{ id: string }>();
  const router = useRouter();

  const [techs, setTechs]       = useState<TechStatus[]>([]);
  const [scanning, setScanning] = useState(true);
  const [error, setError]       = useState('');
  const [category, setCategory] = useState<Category>('all');

  // Install modal
  const [target, setTarget]   = useState<TechStatus | null>(null);
  const [selVer, setSelVer]   = useState('');
  const [jobId, setJobId]     = useState('');
  const [logs, setLogs]       = useState('');
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const logsRef = useRef<HTMLPreElement>(null);

  const token = () => localStorage.getItem('cubiq_token') ?? '';
  const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  /* ── Scan ───────────────────────────────────────────────────────────────── */
  const scan = useCallback(async () => {
    setScanning(true); setError('');
    try {
      const res  = await fetch(`${API}/api/v1/servers/${serverId}/technologies`, { headers: headers() });
      const data = await res.json();
      if (data.success) setTechs(data.data);
      else setError(data.error ?? 'Tarama başarısız');
    } catch { setError('Sunucuya bağlanılamadı.'); }
    finally { setScanning(false); }
  }, [serverId]);

  useEffect(() => {
    if (!localStorage.getItem('cubiq_token')) { router.push('/login'); return; }
    scan();
  }, [scan, router]);

  /* ── Auto-scroll logs ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  /* ── Open install modal ─────────────────────────────────────────────────── */
  const openInstall = (tech: TechStatus) => {
    setTarget(tech);
    setSelVer(tech.defaultVersion ?? tech.versions?.[0]?.value ?? '');
    setJobId(''); setLogs(''); setJobStatus('idle');
  };

  /* ── Start install/upgrade ──────────────────────────────────────────────── */
  const startInstall = async (action: 'install' | 'upgrade') => {
    if (!target) return;
    setJobStatus('running'); setLogs('');

    const res  = await fetch(`${API}/api/v1/servers/${serverId}/technologies/install`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ techId: target.id, version: selVer || undefined, action }),
    });
    const data = await res.json();
    if (!data.success) { setJobStatus('failed'); setLogs(data.error ?? 'Hata'); return; }

    const jid = data.data.jobId;
    setJobId(jid);

    // SSE stream
    const es = new EventSource(
      `${API}/api/v1/servers/${serverId}/technologies/jobs/${jid}/stream`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { headers: { Authorization: `Bearer ${token()}` } } as any,
    );
    es.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.log) setLogs(prev => prev + msg.log);
      if (msg.done) {
        setJobStatus(msg.status === 'success' ? 'success' : 'failed');
        es.close();
        scan(); // Taramayı yenile
      }
      if (msg.error) { setLogs(msg.error); setJobStatus('failed'); es.close(); }
    };
    es.onerror = () => { setJobStatus('failed'); es.close(); };
  };

  /* ── Service control ────────────────────────────────────────────────────── */
  const serviceAction = async (tech: TechStatus, action: 'start' | 'stop' | 'restart') => {
    setTarget(tech); setJobStatus('running'); setLogs(''); setJobId('');

    const res  = await fetch(`${API}/api/v1/servers/${serverId}/technologies/service`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ techId: tech.id, action }),
    });
    const data = await res.json();
    if (!data.success) { setJobStatus('failed'); setLogs(data.error ?? 'Hata'); return; }

    const jid = data.data.jobId;
    setJobId(jid);

    const es = new EventSource(
      `${API}/api/v1/servers/${serverId}/technologies/jobs/${jid}/stream`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { headers: { Authorization: `Bearer ${token()}` } } as any,
    );
    es.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.log) setLogs(prev => prev + msg.log);
      if (msg.done) { setJobStatus(msg.status === 'success' ? 'success' : 'failed'); es.close(); scan(); }
    };
    es.onerror = () => { setJobStatus('failed'); es.close(); };
  };

  /* ── Filter ─────────────────────────────────────────────────────────────── */
  const displayed = category === 'all' ? techs : techs.filter(t => t.category === category);
  const categories = ['all', ...Array.from(new Set(techs.map(t => t.category)))] as Category[];
  const installedCount = techs.filter(t => t.installed).length;

  /* ── Status helpers ─────────────────────────────────────────────────────── */
  const svcColor = (s?: string) =>
    s === 'running'  ? 'bg-green-500' :
    s === 'stopped'  ? 'bg-red-500' :
    'bg-gray-400';

  const svcLabel = (s?: string) =>
    s === 'running' ? 'Çalışıyor' : s === 'stopped' ? 'Durdu' : '—';

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/servers/${serverId}`} className="text-muted-foreground hover:text-foreground text-sm">← Sunucu Detayı</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold">Teknoloji Yönetimi</h1>
          {!scanning && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {installedCount}/{techs.length} kurulu
            </span>
          )}
        </div>
        <button onClick={scan} disabled={scanning}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors flex items-center gap-2">
          {scanning ? <span className="animate-spin">↻</span> : '↻'} {scanning ? 'Taranıyor…' : 'Yeniden Tara'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>}

      {/* Category tabs */}
      {!scanning && (
        <div className="flex gap-1.5 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {CATEGORY_LABELS[c] ?? c}
              {c !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({techs.filter(t => t.category === c && t.installed).length}/{techs.filter(t => t.category === c).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Scanning skeleton */}
      {scanning && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-4 animate-pulse bg-muted/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-muted" />
                <div className="space-y-1 flex-1">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-2 bg-muted rounded w-14" />
                </div>
              </div>
              <div className="h-2 bg-muted rounded w-full mb-4" />
              <div className="h-8 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Tech grid */}
      {!scanning && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(tech => (
            <TechCard
              key={tech.id}
              tech={tech}
              onInstall={() => openInstall(tech)}
              onService={action => serviceAction(tech, action)}
            />
          ))}
        </div>
      )}

      {/* Install / Log Modal */}
      {target && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{target.icon}</span>
                <div>
                  <h2 className="font-bold">{target.name}</h2>
                  <p className="text-xs text-muted-foreground">{target.description}</p>
                </div>
              </div>
              <button onClick={() => { setTarget(null); setJobStatus('idle'); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>

            {/* Version selector (only when idle) */}
            {jobStatus === 'idle' && (
              <div className="px-5 py-4 border-b space-y-3">
                {target.versions && target.versions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium block mb-1">Versiyon seç</label>
                    <select value={selVer} onChange={e => setSelVer(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                      {target.versions.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {target.installed ? (
                  <div className="flex gap-2">
                    <span className="text-sm text-muted-foreground my-auto">Kurulu: <strong>{target.version}</strong></span>
                    <div className="flex-1" />
                    <button onClick={() => startInstall('upgrade')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      ↑ Güncelle / Yeniden Kur
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button onClick={() => startInstall('install')}
                      className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                      Kur {selVer ? `v${selVer}` : ''}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Status bar */}
            {jobStatus !== 'idle' && (
              <div className={`px-5 py-2 text-sm font-medium flex items-center gap-2 ${
                jobStatus === 'running' ? 'bg-blue-50 text-blue-700' :
                jobStatus === 'success' ? 'bg-green-50 text-green-700' :
                'bg-red-50 text-red-700'}`}>
                {jobStatus === 'running' && <span className="animate-spin">↻</span>}
                {jobStatus === 'success' && '✓'}
                {jobStatus === 'failed'  && '✗'}
                {jobStatus === 'running' ? 'Kurulum devam ediyor...' :
                 jobStatus === 'success' ? 'Kurulum tamamlandı!' :
                 'Kurulum başarısız!'}
              </div>
            )}

            {/* Log output */}
            {(jobStatus !== 'idle' || logs) && (
              <pre ref={logsRef}
                className="flex-1 overflow-auto bg-zinc-950 text-green-300 text-xs p-4 font-mono leading-relaxed min-h-[200px] max-h-[50vh]">
                {logs || 'Bağlanılıyor...'}
                {jobStatus === 'running' && <span className="animate-pulse">▌</span>}
              </pre>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              {jobStatus === 'success' && (
                <button onClick={() => { setTarget(null); setJobStatus('idle'); }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Kapat</button>
              )}
              {jobStatus === 'failed' && (
                <>
                  <button onClick={() => { setJobStatus('idle'); setLogs(''); }}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm">Tekrar Dene</button>
                  <button onClick={() => { setTarget(null); setJobStatus('idle'); }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Kapat</button>
                </>
              )}
              {jobStatus === 'idle' && (
                <button onClick={() => setTarget(null)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm">İptal</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tech Card ───────────────────────────────────────────────────────────── */
function TechCard({
  tech,
  onInstall,
  onService,
}: {
  tech: TechStatus;
  onInstall: () => void;
  onService: (a: 'start' | 'stop' | 'restart') => void;
}) {
  const svcDot = (s?: string) =>
    s === 'running' ? 'bg-green-500' : s === 'stopped' ? 'bg-red-500' : 'bg-gray-400';
  const svcLabel = (s?: string) =>
    s === 'running' ? 'Çalışıyor' : s === 'stopped' ? 'Durdu' : '—';

  return (
    <div className={`border rounded-xl p-4 flex flex-col gap-3 transition-all hover:shadow-md ${
      tech.installed ? 'bg-card' : 'bg-muted/20 opacity-80'
    }`}>
      {/* Top */}
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none mt-0.5">{tech.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-sm">{tech.name}</h3>
            {tech.installed && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                v{tech.version}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tech.description}</p>
        </div>
      </div>

      {/* Service status */}
      {tech.installed && tech.serviceStatus !== 'unknown' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${svcDot(tech.serviceStatus)}`} />
          {svcLabel(tech.serviceStatus)}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {!tech.installed ? (
          <button onClick={onInstall}
            className="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            + Kur
          </button>
        ) : (
          <>
            <button onClick={onInstall}
              className="flex-1 px-2 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors">
              ↑ Güncelle
            </button>
            {tech.serviceStatus === 'stopped' && (
              <button onClick={() => onService('start')}
                className="px-2 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors">
                ▶ Başlat
              </button>
            )}
            {tech.serviceStatus === 'running' && (
              <>
                <button onClick={() => onService('restart')}
                  className="px-2 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200 transition-colors">
                  ↺ Restart
                </button>
                <button onClick={() => onService('stop')}
                  className="px-2 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
                  ■ Durdur
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
