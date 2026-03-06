'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon, RefreshCwIcon, TrashIcon, ShieldIcon,
  FileIcon, HardDriveIcon, PackageIcon, AlertTriangleIcon,
  CheckCircleIcon, XCircleIcon, Loader2Icon, ChevronDownIcon,
  ChevronUpIcon, TerminalIcon, FolderIcon,
} from 'lucide-react';
import { AUTH_TOKEN_KEY, API_BASE } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DiskUsage { filesystem: string; size: string; used: string; available: string; usePct: string; mountpoint: string; }
interface Overview { diskUsage: DiskUsage[]; logsDirSize: string; dockerDirSize: string; tmpDirSize: string; }
interface LogFile { path: string; size: number; sizeHuman: string; modified: string; }
interface DockerItem { id: string; name: string; image?: string; status?: string; sizeHuman?: string; type: 'container' | 'volume' | 'image'; }
interface DockerAnalysis { containers: DockerItem[]; volumes: DockerItem[]; images: DockerItem[]; available: boolean; }
interface LargeFile { path: string; size: number; sizeHuman: string; modified: string; isDir: boolean; }

type JobStatus = 'idle' | 'running' | 'success' | 'failed';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const API = API_BASE;

function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!url) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [url]);

  return { data, loading, error, refetch: fetch_ };
}

// ─── SSE Job Modal ────────────────────────────────────────────────────────────
function JobModal({ jobId, serverId, title, onClose }: { jobId: string; serverId: string; title: string; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<JobStatus>('running');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const url = `${API}/api/v1/servers/${serverId}/maintenance/jobs/${jobId}/stream`;
    const es = new EventSource(`${url}?token=${token}`);

    const append = (line: string) => setLines(p => [...p, line]);

    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'log')  append(d.line);
      if (d.type === 'done') { setStatus(d.status === 'success' ? 'success' : 'failed'); es.close(); }
    };
    es.onerror = () => { setStatus('failed'); es.close(); };

    return () => es.close();
  }, [jobId, serverId]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [lines]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {status === 'running' && <Loader2Icon className="h-4 w-4 animate-spin text-blue-400" />}
            {status === 'success' && <CheckCircleIcon className="h-4 w-4 text-green-400" />}
            {status === 'failed'  && <XCircleIcon className="h-4 w-4 text-red-400" />}
            {status !== 'running' && (
              <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Kapat</button>
            )}
          </div>
        </div>
        {/* Log output */}
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-zinc-950 text-zinc-300 rounded-b-xl"
          style={{ minHeight: 300 }}
        >
          {lines.map((l, i) => (
            <div key={i} className={l.startsWith('✓') ? 'text-green-400' : l.startsWith('✗') || l.startsWith('⚠') ? 'text-yellow-400' : ''}>{l}</div>
          ))}
          {status === 'running' && <div className="text-zinc-500 animate-pulse">▋</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Bölüm kapsayıcı ─────────────────────────────────────────────────────────
function Section({ title, icon, children, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; badge?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-semibold text-sm">{title}</span>
          {badge && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {open ? <ChevronUpIcon className="h-4 w-4 text-muted-foreground" /> : <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

// ─── Disk kullanımı tablosu ───────────────────────────────────────────────────
function DiskBar({ pct }: { pct: string }) {
  const n = parseInt(pct);
  const color = n > 90 ? 'bg-red-500' : n > 75 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: pct }} />
      </div>
      <span className="text-xs w-10 text-right text-muted-foreground">{pct}</span>
    </div>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Overview
  const { data: overview, loading: ovLoading, error: ovErr, refetch: fetchOverview } = useApi<Overview>(null);
  const [ovFetched, setOvFetched] = useState(false);

  // Log analiz
  const [logs, setLogs] = useState<LogFile[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());

  // Docker analiz
  const [docker, setDocker] = useState<DockerAnalysis | null>(null);
  const [dockerLoading, setDockerLoading] = useState(false);
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // Büyük dosyalar
  const [files, setFiles] = useState<LargeFile[] | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [minSizeMB, setMinSizeMB] = useState(100);

  // Job modal
  const [activeJob, setActiveJob] = useState<{ jobId: string; title: string } | null>(null);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  // Genel bakış + log analizi birlikte yükle
  useEffect(() => {
    if (ovFetched) return;
    setOvFetched(true);
    (async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API}/api/v1/servers/${id}/maintenance/overview`, { headers });
      const json = await res.json();
      // overview state'i doğrudan set et (useApi hook'u burada kullanmıyoruz)
    })();
  }, [id, ovFetched]);

  const loadOverview = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const res = await fetch(`${API}/api/v1/servers/${id}/maintenance/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setOverviewData(json.data);
  }, [id]);

  const [overviewData, setOverviewData] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    setOverviewLoading(true);
    loadOverview().finally(() => setOverviewLoading(false));
  }, [loadOverview]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/servers/${id}/maintenance/logs`, { headers: authHeaders() });
      const json = await res.json();
      setLogs(json.data ?? []);
      setSelectedLogs(new Set());
    } finally { setLogsLoading(false); }
  }, [id, authHeaders]);

  const loadDocker = useCallback(async () => {
    setDockerLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/servers/${id}/maintenance/docker`, { headers: authHeaders() });
      const json = await res.json();
      setDocker(json.data);
      setSelectedContainers(new Set());
      setSelectedVolumes(new Set());
      setSelectedImages(new Set());
    } finally { setDockerLoading(false); }
  }, [id, authHeaders]);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/servers/${id}/maintenance/files?minSizeMB=${minSizeMB}`, { headers: authHeaders() });
      const json = await res.json();
      setFiles(json.data ?? []);
      setSelectedFiles(new Set());
    } finally { setFilesLoading(false); }
  }, [id, authHeaders, minSizeMB]);

  // ─── Aksiyonlar ──────────────────────────────────────────────────────────────

  const startJob = useCallback(async (url: string, body?: unknown, title = 'İşlem') => {
    const res = await fetch(`${API}${url}`, {
      method: 'POST',
      headers: authHeaders(),
      // Fastify boş body + Content-Type:application/json kombinasyonunu reddeder.
      // body yoksa '{}' gönderilir, Content-Type header'ı geçerli kalır.
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Hata');
    setActiveJob({ jobId: json.data.jobId, title });
  }, [authHeaders]);

  const handleCleanLogs = () => startJob(`/api/v1/servers/${id}/maintenance/logs/clean`, undefined, 'Log Temizleme');

  const handleCleanDocker = () => startJob(
    `/api/v1/servers/${id}/maintenance/docker/clean`,
    {
      containers: [...selectedContainers],
      volumes:    [...selectedVolumes],
      images:     [...selectedImages],
    },
    'Docker Temizleme',
  );

  const handleDeleteFiles = () => {
    if (!selectedFiles.size) return;
    if (!confirm(`${selectedFiles.size} dosya kalıcı olarak silinecek. Devam etmek istiyor musunuz?`)) return;
    startJob(`/api/v1/servers/${id}/maintenance/files/delete`, { paths: [...selectedFiles] }, 'Dosya Silme');
  };

  const handleMalwareScan = () => startJob(`/api/v1/servers/${id}/maintenance/malware-scan`, undefined, 'Zararlı Yazılım Taraması');

  // ─── Toggle helpers ──────────────────────────────────────────────────────────
  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id_: string) => {
    const next = new Set(set);
    next.has(id_) ? next.delete(id_) : next.add(id_);
    setFn(next);
  };

  const toggleAll = <T extends { id: string }>(
    items: T[],
    selected: Set<string>,
    setFn: (s: Set<string>) => void,
  ) => {
    if (selected.size === items.length) setFn(new Set());
    else setFn(new Set(items.map(i => i.id)));
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/servers/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Sunucu Bakımı</h1>
          <p className="text-sm text-muted-foreground">Log temizleme, Docker yönetimi, dosya analizi ve güvenlik taraması</p>
        </div>
      </div>

      {/* === 1. GENEL BAKIŞ === */}
      <Section title="Disk Kullanımı" icon={<HardDriveIcon className="h-4 w-4 text-primary" />}>
        {overviewLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2Icon className="h-4 w-4 animate-spin" /> Yükleniyor...
          </div>
        ) : overviewData ? (
          <div className="space-y-4 mt-3">
            {/* Özet kartlar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Loglar (/var/log)', value: overviewData.logsDirSize, icon: FileIcon },
                { label: 'Docker', value: overviewData.dockerDirSize, icon: PackageIcon },
                { label: '/tmp', value: overviewData.tmpDirSize, icon: FolderIcon },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg border border-border p-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </div>
                  <div className="text-lg font-bold">{value}</div>
                </div>
              ))}
            </div>
            {/* Disk tablosu */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    {['Dosya Sistemi', 'Boyut', 'Kullanılan', 'Boş', 'Kullanım', 'Bağlantı Noktası'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overviewData.diskUsage.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{d.filesystem}</td>
                      <td className="py-2 pr-4">{d.size}</td>
                      <td className="py-2 pr-4 text-yellow-500">{d.used}</td>
                      <td className="py-2 pr-4 text-green-500">{d.available}</td>
                      <td className="py-2 pr-4 w-36"><DiskBar pct={d.usePct} /></td>
                      <td className="py-2 font-mono">{d.mountpoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-3">Disk bilgisi yüklenemedi.</p>
        )}
      </Section>

      {/* === 2. LOG TEMİZLEME === */}
      <Section title="Log Temizleme" icon={<FileIcon className="h-4 w-4 text-orange-400" />}>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            1 MB üzerindeki log dosyaları listelenir. Journal logları 100 MB ile kısıtlanır, rotated (.gz, .old) dosyalar silinir.
          </p>
          <div className="flex gap-2">
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              {logsLoading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <RefreshCwIcon className="h-3.5 w-3.5" />}
              Analiz Et
            </button>
            <button
              onClick={handleCleanLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Logları Temizle
            </button>
          </div>

          {logs && (
            logs.length === 0 ? (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircleIcon className="h-3.5 w-3.5" /> 1 MB üzerinde log dosyası bulunamadı
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Dosya</th>
                      <th className="text-left py-2 pr-3 font-medium">Boyut</th>
                      <th className="text-left py-2 font-medium">Son Değişiklik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(f => (
                      <tr key={f.path} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 pr-3 font-mono max-w-xs truncate">{f.path}</td>
                        <td className="py-2 pr-3 text-orange-400 font-mono">{f.sizeHuman}</td>
                        <td className="py-2 text-muted-foreground">{f.modified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">{logs.length} büyük log dosyası bulundu (toplam gösterilen)</p>
              </div>
            )
          )}
        </div>
      </Section>

      {/* === 3. DOCKER TEMİZLEME === */}
      <Section
        title="Docker Temizleme"
        icon={<PackageIcon className="h-4 w-4 text-blue-400" />}
        badge={docker ? `${docker.containers.length + docker.volumes.length + docker.images.length} öğe` : undefined}
      >
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            Durmuş container'lar, kullanılmayan volume'ler ve dağınık image'lar listelenir.
            Veritabanı container ve volume'leri (PostgreSQL, MySQL vb.) korunur.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={loadDocker}
              disabled={dockerLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              {dockerLoading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <RefreshCwIcon className="h-3.5 w-3.5" />}
              Analiz Et
            </button>
            {docker && (selectedContainers.size + selectedVolumes.size + selectedImages.size) > 0 && (
              <button
                onClick={handleCleanDocker}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Seçilenleri Sil ({selectedContainers.size + selectedVolumes.size + selectedImages.size})
              </button>
            )}
          </div>

          {docker && !docker.available && (
            <p className="text-xs text-muted-foreground">Docker bu sunucuda kurulu değil veya çalışmıyor.</p>
          )}

          {docker?.available && (
            <div className="space-y-4">
              {/* Containers */}
              {docker.containers.length > 0 && (
                <DockerTable
                  title="Durmuş Container'lar"
                  items={docker.containers}
                  selected={selectedContainers}
                  onToggle={(item) => toggle(selectedContainers, setSelectedContainers, item.id)}
                  onToggleAll={() => toggleAll(docker.containers, selectedContainers, setSelectedContainers)}
                  columns={['Ad', 'Image', 'Durum']}
                  renderRow={(item) => [item.name, item.image ?? '-', item.status ?? '-']}
                />
              )}
              {/* Volumes */}
              {docker.volumes.length > 0 && (
                <DockerTable
                  title="Kullanılmayan Volume'ler"
                  items={docker.volumes}
                  selected={selectedVolumes}
                  onToggle={(item) => toggle(selectedVolumes, setSelectedVolumes, item.id)}
                  onToggleAll={() => toggleAll(docker.volumes, selectedVolumes, setSelectedVolumes)}
                  columns={['Ad']}
                  renderRow={(item) => [item.name]}
                />
              )}
              {/* Images */}
              {docker.images.length > 0 && (
                <DockerTable
                  title="Image Listesi"
                  items={docker.images}
                  selected={selectedImages}
                  onToggle={(item) => toggle(selectedImages, setSelectedImages, item.id)}
                  onToggleAll={() => toggleAll(docker.images, selectedImages, setSelectedImages)}
                  columns={['Ad/Tag', 'Boyut']}
                  renderRow={(item) => [item.name, item.sizeHuman ?? '-']}
                />
              )}
              {docker.containers.length === 0 && docker.volumes.length === 0 && docker.images.length === 0 && (
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Temizlenecek Docker kaynağı bulunamadı
                </p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* === 4. BÜYÜK DOSYALAR === */}
      <Section
        title="Büyük Dosya Analizi"
        icon={<HardDriveIcon className="h-4 w-4 text-purple-400" />}
        badge={files ? `${files.length} dosya` : undefined}
      >
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Belirtilen boyutun üzerindeki dosyaları listeler. Seçerek silebilirsiniz.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Min boyut:</label>
              <select
                value={minSizeMB}
                onChange={e => setMinSizeMB(Number(e.target.value))}
                className="text-xs border border-border rounded px-2 py-1 bg-background"
              >
                {[50, 100, 250, 500, 1000].map(v => (
                  <option key={v} value={v}>{v >= 1000 ? `${v / 1000} GB` : `${v} MB`}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadFiles}
              disabled={filesLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              {filesLoading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <RefreshCwIcon className="h-3.5 w-3.5" />}
              Tara
            </button>
            {selectedFiles.size > 0 && (
              <button
                onClick={handleDeleteFiles}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Seçilenleri Sil ({selectedFiles.size})
              </button>
            )}
          </div>

          {files && (
            files.length === 0 ? (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircleIcon className="h-3.5 w-3.5" /> {minSizeMB} MB üzerinde dosya bulunamadı
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="w-8 py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedFiles.size === files.length}
                          onChange={() => {
                            if (selectedFiles.size === files.length) setSelectedFiles(new Set());
                            else setSelectedFiles(new Set(files.map(f => f.path)));
                          }}
                        />
                      </th>
                      <th className="text-left py-2 pr-3 font-medium">Yol</th>
                      <th className="text-left py-2 pr-3 font-medium">Boyut</th>
                      <th className="text-left py-2 pr-3 font-medium">Tür</th>
                      <th className="text-left py-2 font-medium">Değişiklik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr
                        key={f.path}
                        className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer ${selectedFiles.has(f.path) ? 'bg-red-500/5' : ''}`}
                        onClick={() => toggle(selectedFiles, setSelectedFiles, f.path)}
                      >
                        <td className="py-2 pr-2">
                          <input type="checkbox" checked={selectedFiles.has(f.path)} readOnly />
                        </td>
                        <td className="py-2 pr-3 font-mono max-w-xs truncate">{f.path}</td>
                        <td className="py-2 pr-3 text-purple-400 font-mono font-bold">{f.sizeHuman}</td>
                        <td className="py-2 pr-3">
                          {f.isDir
                            ? <span className="text-blue-400">📁 Dizin</span>
                            : <span className="text-muted-foreground">📄 Dosya</span>}
                        </td>
                        <td className="py-2 text-muted-foreground">{f.modified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </Section>

      {/* === 5. ZARARLI YAZILIM TARAMASI === */}
      <Section title="Zararlı Yazılım & Güvenlik Taraması" icon={<ShieldIcon className="h-4 w-4 text-red-400" />}>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            SUID/SGID dosyaları, şüpheli geçici dosyalar, crontab kayıtları, açık portlar ve rootkit taraması (rkhunter/chkrootkit/ClamAV) yapılır.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { label: 'SUID/SGID', desc: 'Yetki yükseltme' },
              { label: 'Geçici Dosyalar', desc: '/tmp çalıştırılabilir' },
              { label: 'Crontab', desc: 'Zamanlanmış görevler' },
              { label: 'Ağ Bağlantıları', desc: 'Açık portlar' },
            ].map(({ label, desc }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 p-2.5">
                <div className="font-medium text-foreground">{label}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
          <button
            onClick={handleMalwareScan}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
          >
            <ShieldIcon className="h-4 w-4" />
            Güvenlik Taraması Başlat
          </button>
          <p className="text-xs text-muted-foreground">
            ⚠ Tarama sunucuya yük bindirebilir. Yoğun saatlerde çalıştırmayı önermiyoruz.
          </p>
        </div>
      </Section>

      {/* SSE Job Modal */}
      {activeJob && (
        <JobModal
          jobId={activeJob.jobId}
          serverId={id}
          title={activeJob.title}
          onClose={() => {
            setActiveJob(null);
            loadOverview();
          }}
        />
      )}
    </div>
  );
}

// ─── Docker tablo alt bileşeni ────────────────────────────────────────────────
function DockerTable({
  title, items, selected, onToggle, onToggleAll, columns, renderRow,
}: {
  title: string;
  items: DockerItem[];
  selected: Set<string>;
  onToggle: (item: DockerItem) => void;
  onToggleAll: () => void;
  columns: string[];
  renderRow: (item: DockerItem) => string[];
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{title} ({items.length})</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="w-8 py-2 pr-2">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={onToggleAll}
              />
            </th>
            {columns.map(c => <th key={c} className="text-left py-2 pr-3 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer ${selected.has(item.id) ? 'bg-blue-500/5' : ''}`}
              onClick={() => onToggle(item)}
            >
              <td className="py-2 pr-2">
                <input type="checkbox" checked={selected.has(item.id)} readOnly />
              </td>
              {renderRow(item).map((cell, i) => (
                <td key={i} className="py-2 pr-3 font-mono max-w-xs truncate">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
