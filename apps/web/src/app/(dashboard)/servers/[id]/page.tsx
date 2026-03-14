'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import {
  ServerIcon,
  ArrowLeftIcon,
  ContainerIcon,
  GlobeIcon,
  PlusIcon,
  RefreshCwIcon,
  ZapIcon,
  TrashIcon,
  ShieldCheckIcon,
  ScanSearchIcon,
  CpuIcon,
  HardDriveIcon,
  PlayIcon,
  StopCircleIcon,
  Trash2Icon,
  ScrollTextIcon,
  XIcon,
  AlertTriangleIcon,
  MemoryStickIcon,
  TerminalIcon,
  DatabaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon as TrashIconDb,
} from 'lucide-react';
import Link from 'next/link';
import { TerminalModal } from '@/components/terminal/terminal-modal';
import { formatDate, formatBytes } from '@/lib/utils';
import type { Server, Domain, ScanData } from '@cubiqport/shared';

interface LiveMetrics {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  networkUsage: { rx: number; tx: number };
  containers: { id: string; name: string; status: string; image: string; ports: string[] }[];
  uptime: number;
  timestamp: string;
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  memUsage: string;
  memPercent: string;
  cpuPercent: string;
  ports: string;
  restartCount: number;
  createdAt: string;
}

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

// ─── Log Modal ────────────────────────────────────────────────────────────────
function LogModal({
  containerName,
  logs,
  onClose,
  onRefresh,
  loading,
}: {
  containerName: string;
  logs: string;
  onClose: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-3xl max-h-[80vh] rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ScrollTextIcon className="h-4 w-4 text-sky-400" />
            <span className="font-semibold text-sm">{containerName} — Loglar</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-secondary"
            >
              <RefreshCwIcon className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <pre
          ref={logRef}
          className="flex-1 overflow-auto p-4 text-xs font-mono text-muted-foreground leading-relaxed bg-black/30 rounded-b-xl whitespace-pre-wrap break-all"
        >
          {loading ? 'Loglar yükleniyor…' : logs || '(log yok)'}
        </pre>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({
  containerName,
  onConfirm,
  onCancel,
  loading,
}: {
  containerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangleIcon className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold">Container Sil</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bu işlem geri alınamaz</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          <span className="font-mono font-semibold text-foreground">{containerName}</span> container&apos;ı kalıcı olarak silinecek. Emin misiniz?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {loading ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Docker Containers Section ────────────────────────────────────────────────
function DockerContainersSection({ serverId, token }: { serverId: string; token: string }) {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [logModal, setLogModal] = useState<{ name: string; logs: string; loading: boolean } | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const loadContainers = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/containers`, { headers });
      if (res.ok) {
        const j = await res.json();
        setContainers(j.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [serverId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadContainers();
    const iv = setInterval(loadContainers, 15_000);
    return () => clearInterval(iv);
  }, [loadContainers]);

  async function fetchLogs(name: string) {
    setLogModal({ name, logs: '', loading: true });
    const res = await fetch(`/api/v1/servers/${serverId}/containers/${encodeURIComponent(name)}/logs?lines=200`, { headers });
    const j = await res.json();
    setLogModal({ name, logs: j.data ?? '', loading: false });
  }

  async function action(name: string, act: 'restart' | 'stop') {
    setActionLoading(`${act}:${name}`);
    setMsg('');
    const method = 'POST';
    const res = await fetch(`/api/v1/servers/${serverId}/containers/${encodeURIComponent(name)}/${act}`, { method, headers });
    const j = await res.json();
    if (res.ok) {
      setMsg(`✓ ${name} ${act === 'restart' ? 'yeniden başlatıldı' : 'durduruldu'}`);
      setTimeout(loadContainers, 2000);
    } else {
      setMsg(`✗ ${j.error ?? 'İşlem başarısız'}`);
    }
    setActionLoading('');
  }

  async function deleteContainer(name: string) {
    setActionLoading(`remove:${name}`);
    const res = await fetch(`/api/v1/servers/${serverId}/containers/${encodeURIComponent(name)}`, { method: 'DELETE', headers });
    const j = await res.json();
    if (res.ok) {
      setMsg(`✓ ${name} silindi`);
      setDeleteModal(null);
      loadContainers();
    } else {
      setMsg(`✗ ${j.error ?? 'Silme başarısız'}`);
    }
    setActionLoading('');
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {logModal && (
        <LogModal
          containerName={logModal.name}
          logs={logModal.logs}
          loading={logModal.loading}
          onClose={() => setLogModal(null)}
          onRefresh={() => fetchLogs(logModal.name)}
        />
      )}
      {deleteModal && (
        <DeleteModal
          containerName={deleteModal}
          loading={actionLoading === `remove:${deleteModal}`}
          onConfirm={() => deleteContainer(deleteModal)}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Docker Container&apos;lar {!loading && `(${containers.length})`}
        </h3>
        <button
          onClick={() => { setLoading(true); loadContainers(); }}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCwIcon className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {msg && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${msg.startsWith('✓') ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-destructive/10 border border-destructive/30 text-destructive'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-secondary/30 animate-pulse" />)}
        </div>
      ) : containers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ContainerIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Container bulunamadı</p>
          <p className="text-xs text-muted-foreground">Docker kurulu değil veya hiç container yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {containers.map((c) => {
            const isRunning = c.state === 'running';
            const isPaused = c.state === 'paused';
            return (
              <div key={c.id || c.name} className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
                <div className="flex items-start gap-3">
                  {/* Icon + state dot */}
                  <div className="relative mt-0.5 shrink-0">
                    <ContainerIcon className="h-5 w-5 text-sky-400" />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card ${isRunning ? 'bg-green-400' : isPaused ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{c.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isRunning ? 'bg-green-500/10 text-green-400' : isPaused ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                        {isRunning ? 'Çalışıyor' : isPaused ? 'Duraklatıldı' : 'Durdu'}
                      </span>
                      {c.restartCount > 0 && (
                        <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
                          {c.restartCount}× yeniden başladı
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">{c.image}</p>

                    {/* Stats row */}
                    {isRunning && (c.memUsage !== '—' || c.cpuPercent !== '—') && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {c.cpuPercent && c.cpuPercent !== '—' && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CpuIcon className="h-3 w-3" />
                            CPU: <span className="font-medium text-foreground">{c.cpuPercent}</span>
                          </span>
                        )}
                        {c.memUsage && c.memUsage !== '—' && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MemoryStickIcon className="h-3 w-3" />
                            RAM: <span className="font-medium text-foreground">{c.memUsage}</span>
                            {c.memPercent && c.memPercent !== '—' && (
                              <span className="text-muted-foreground">({c.memPercent})</span>
                            )}
                          </span>
                        )}
                        {c.ports && (
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                            :{c.ports}
                          </span>
                        )}
                      </div>
                    )}

                    {!isRunning && c.status && (
                      <p className="text-xs text-muted-foreground mt-1">{c.status}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Logs */}
                    <button
                      onClick={() => fetchLogs(c.name)}
                      title="Logları Görüntüle"
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <ScrollTextIcon className="h-4 w-4" />
                    </button>

                    {/* Restart */}
                    <button
                      onClick={() => action(c.name, 'restart')}
                      disabled={!!actionLoading}
                      title="Yeniden Başlat"
                      className="rounded p-1.5 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-400 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === `restart:${c.name}`
                        ? <RefreshCwIcon className="h-4 w-4 animate-spin" />
                        : <PlayIcon className="h-4 w-4" />}
                    </button>

                    {/* Stop (only when running) */}
                    {isRunning && (
                      <button
                        onClick={() => action(c.name, 'stop')}
                        disabled={!!actionLoading}
                        title="Durdur"
                        className="rounded p-1.5 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `stop:${c.name}`
                          ? <RefreshCwIcon className="h-4 w-4 animate-spin" />
                          : <StopCircleIcon className="h-4 w-4" />}
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteModal(c.name)}
                      disabled={!!actionLoading}
                      title="Sil"
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Server Databases Section (sunucudaki MySQL/Postgres bağlantıları) ────────
interface DbConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgres';
  host: string;
  port: number;
  username: string;
  createdAt: string;
}

function ServerDatabasesSection({ serverId, headers }: { serverId: string; headers: Record<string, string> }) {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [expandedConn, setExpandedConn] = useState<string | null>(null);
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [databasesByConn, setDatabasesByConn] = useState<Record<string, string[]>>({});
  const [tablesByDb, setTablesByDb] = useState<Record<string, string[]>>({});
  const [loadingDb, setLoadingDb] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'mysql' as 'mysql' | 'postgres', host: '127.0.0.1', port: '3306', username: '', password: '' });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/db-connections`, { headers });
      const json = await res.json();
      if (res.ok) setConnections(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [serverId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/db-connections`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          host: form.host,
          port: parseInt(form.port, 10) || (form.type === 'mysql' ? 3306 : 5432),
          username: form.username,
          password: form.password,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setForm({ name: '', type: 'mysql', host: '127.0.0.1', port: '3306', username: '', password: '' });
        await load();
      } else {
        const j = await res.json();
        alert(j.error ?? 'Eklenemedi');
      }
    } finally {
      setAddLoading(false);
    }
  }

  async function loadDatabases(connId: string) {
    setLoadingDb(connId);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/db-connections/${connId}/databases`, { headers });
      const json = await res.json();
      if (res.ok) setDatabasesByConn((prev) => ({ ...prev, [connId]: json.data ?? [] }));
    } finally {
      setLoadingDb(null);
    }
  }

  async function loadTables(connId: string, dbName: string) {
    const key = `${connId}:${dbName}`;
    setLoadingDb(key);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/db-connections/${connId}/databases/${encodeURIComponent(dbName)}/tables`, { headers });
      const json = await res.json();
      if (res.ok) setTablesByDb((prev) => ({ ...prev, [key]: json.data ?? [] }));
    } finally {
      setLoadingDb(null);
    }
  }

  async function deleteConn(connId: string) {
    if (!confirm('Bu bağlantıyı silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/v1/servers/${serverId}/db-connections/${connId}`, { method: 'DELETE', headers });
    if (res.ok) await load();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Sunucudaki Veritabanları
        </h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Bağlantı Ekle
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Sunucuda çalışan MySQL/PostgreSQL bağlantı bilgilerini ekleyin; veritabanları ve tabloları listeleyebilirsiniz.
      </p>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h4 className="font-semibold mb-4">Veritabanı bağlantısı ekle</h4>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Ad</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Örn: Ana MySQL" className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tür</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'mysql' | 'postgres', port: e.target.value === 'mysql' ? '3306' : '5432' }))} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
                  <option value="mysql">MySQL</option>
                  <option value="postgres">PostgreSQL</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Host</label>
                  <input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Port</label>
                  <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Kullanıcı</label>
                <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Şifre</label>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm" required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">İptal</button>
                <button type="submit" disabled={addLoading} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{addLoading ? 'Ekleniyor…' : 'Ekle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <DatabaseIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Henüz bağlantı eklenmedi.</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-xs text-primary hover:underline">İlk bağlantıyı ekle →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/50"
                onClick={() => {
                  const next = expandedConn === c.id ? null : c.id;
                  setExpandedConn(next);
                  if (next && !databasesByConn[c.id]) loadDatabases(c.id);
                }}
              >
                <div className="flex items-center gap-2">
                  {expandedConn === c.id ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />}
                  <DatabaseIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">({c.type === 'mysql' ? 'MySQL' : 'PostgreSQL'} — {c.host}:{c.port})</span>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); deleteConn(c.id); }} className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Bağlantıyı sil">
                  <TrashIconDb className="h-4 w-4" />
                </button>
              </div>
              {expandedConn === c.id && (
                <div className="border-t border-border px-4 py-3 bg-card/50">
                  {loadingDb === c.id ? (
                    <p className="text-xs text-muted-foreground">Veritabanları yükleniyor…</p>
                  ) : (databasesByConn[c.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Veritabanı bulunamadı veya bağlantı başarısız.</p>
                  ) : (
                    <div className="space-y-2">
                      {(databasesByConn[c.id] ?? []).map((dbName) => {
                        const key = `${c.id}:${dbName}`;
                        const tables = tablesByDb[key];
                        const loadingTables = loadingDb === key;
                        const isExpanded = expandedDb === key;
                        return (
                          <div key={dbName} className="pl-4 border-l-2 border-primary/20">
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-sm text-left w-full py-1 hover:text-primary"
                              onClick={() => {
                                setExpandedDb(isExpanded ? null : key);
                                if (!tables && !loadingTables) loadTables(c.id, dbName);
                              }}
                            >
                              {isExpanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                              <span className="font-mono">{dbName}</span>
                              {loadingTables && <span className="text-xs text-muted-foreground">yükleniyor…</span>}
                            </button>
                            {isExpanded && (
                              <div className="pl-5 py-1 text-xs text-muted-foreground">
                                {loadingTables ? 'Tablolar yükleniyor…' : tables ? `Tablolar: ${tables.length === 0 ? '—' : tables.join(', ')}` : '—'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ServerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useToken();
  const serverId = params.id;

  const [server, setServer] = useState<Server | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [terminalOpen, setTerminalOpen] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadServer = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`/api/v1/servers/${serverId}`, { headers }),
        fetch(`/api/v1/domains?serverId=${serverId}`, { headers }),
      ]);
      const sJson = await sRes.json();
      const dJson = await dRes.json();
      if (!sRes.ok) throw new Error(sJson.error ?? 'Server not found');
      setServer(sJson.data);
      setDomains(dJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load server');
    } finally {
      setLoading(false);
    }
  }, [serverId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/monitoring/servers/${serverId}/live`, { headers });
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.data ?? null);
        setMetricsError(false);
      } else {
        setMetricsError(true);
      }
    } catch {
      setMetricsError(true);
    } finally {
      setMetricsLoading(false);
    }
  }, [serverId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadServer();
    loadMetrics();
    const interval = setInterval(loadMetrics, 10_000);
    return () => clearInterval(interval);
  }, [loadServer, loadMetrics]);

  async function testConnection() {
    setActionLoading('test');
    setActionMsg('');
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/test-connection`, { method: 'POST', headers });
      const json = await res.json();
      setActionMsg(res.ok ? '✓ Bağlantı başarılı' : `✗ ${json.error ?? 'Bağlantı başarısız'}`);
      if (res.ok) loadServer();
    } catch {
      setActionMsg('✗ Bağlantı başarısız');
    } finally {
      setActionLoading('');
    }
  }

  async function provisionAgent() {
    setActionLoading('provision');
    setActionMsg('');
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/provision`, { method: 'POST', headers });
      const json = await res.json();
      setActionMsg(res.ok ? '✓ Agent kurulumu başladı' : `✗ ${json.error ?? 'Kurulum başarısız'}`);
    } catch {
      setActionMsg('✗ Kurulum başarısız');
    } finally {
      setActionLoading('');
    }
  }

  async function removeServer() {
    if (!confirm('Bu sunucuyu silmek istediğinizden emin misiniz?')) return;
    try {
      await fetch(`/api/v1/servers/${serverId}`, { method: 'DELETE', headers });
      router.push('/servers');
    } catch {
      setError('Sunucu silinemedi');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Sunucu Detayı" description="Yükleniyor…" />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="flex flex-col">
        <Header title="Sunucu Detayı" description="Hata" />
        <div className="p-6">
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error || 'Sunucu bulunamadı'}
          </div>
          <Link href="/servers" className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="h-4 w-4" /> Sunuculara Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title={server.name} description={`${server.ip}:${server.sshPort ?? 22}`} />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link
            href="/servers"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Sunuculara Dön
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/servers/${server.id}/technologies`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <span>🛠️</span> Teknoloji Yönetimi
            </Link>
            <Link
              href={`/servers/${server.id}/maintenance`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg text-sm font-medium hover:bg-orange-500/20 transition-colors"
            >
              <span>🧹</span> Sunucu Bakımı
            </Link>
            <button
              type="button"
              onClick={() => setTerminalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <TerminalIcon className="h-4 w-4" />
              Terminale Bağlan
            </button>
          </div>
        </div>

        {/* Server info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <ServerIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{server.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {server.sshUser}@{server.ip}:{server.sshPort ?? 22}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {server.agentVersion && (
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  Agent v{server.agentVersion}
                </span>
              )}
              <StatusBadge status={server.status} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground sm:grid-cols-4">
            <div><span className="text-xs uppercase tracking-wide">Eklendi</span><p className="mt-0.5 text-foreground">{formatDate(server.createdAt)}</p></div>
            <div><span className="text-xs uppercase tracking-wide">Domainler</span><p className="mt-0.5 text-foreground">{domains.length}</p></div>
          </div>
        </div>

        {/* Live metrics */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Canlı Metrikler
            </h3>
            <button onClick={loadMetrics} disabled={metricsLoading} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50">
              <RefreshCwIcon className={`h-3 w-3 ${metricsLoading ? 'animate-spin' : ''}`} /> Yenile
            </button>
          </div>
          {metricsLoading && !metrics ? (
            <div className="text-center py-8">
              <RefreshCwIcon className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">SSH ile metrikler alınıyor…</p>
            </div>
          ) : metrics ? (
            <>
              <div className="flex flex-wrap items-center gap-8 justify-around">
                <ProgressRing value={Math.round(metrics.cpuUsage)} label="CPU" />
                <ProgressRing value={Math.round(metrics.ramUsage)} label="RAM" />
                <ProgressRing value={Math.round(metrics.diskUsage)} label="Disk" />
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs text-muted-foreground">Network</p>
                  <p className="text-sm font-semibold">↑ {formatBytes((metrics.networkUsage?.tx ?? 0) * 1024)}</p>
                  <p className="text-xs text-muted-foreground">↓ {formatBytes((metrics.networkUsage?.rx ?? 0) * 1024)}</p>
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Son güncelleme {new Date(metrics.timestamp).toLocaleTimeString('tr-TR')} · 10 sn&apos;de bir yenilenir
              </p>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Metrik alınamadı.</p>
              <p className="text-xs text-muted-foreground mt-1">SSH bağlantısı veya agent gereklidir.</p>
              <button onClick={loadMetrics} className="mt-3 text-xs text-primary hover:underline">Tekrar dene →</button>
            </div>
          )}
          {metricsError && !metricsLoading && (
            <p className="mt-2 text-center text-xs text-muted-foreground/60">Son güncelleme başarısız</p>
          )}
        </div>

        {/* Domains */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Domainler ({domains.length})
            </h3>
            <a
              href={`/domains/new?serverId=${server.id}`}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Domain Ekle
            </a>
          </div>

          {domains.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <GlobeIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">Bu sunucuda domain yok.</p>
              <a href={`/domains/new?serverId=${server.id}`} className="mt-3 text-xs text-primary hover:underline">
                İlk domaini ekle →
              </a>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Domain</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Durum</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SSL</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Port</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {domains.map((d) => (
                    <tr key={d.id} className="transition hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <a href={`/domains/${d.id}`} className="flex items-center gap-2 font-medium hover:text-primary transition-colors">
                          <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                          {d.domain}
                        </a>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3">
                        {d.sslEnabled ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                            <ShieldCheckIcon className="h-3.5 w-3.5" /> Aktif
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">:{d.port}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Server databases (MySQL/PostgreSQL on this server) */}
        <ServerDatabasesSection serverId={serverId} headers={headers} />

        {/* Docker Containers */}
        <DockerContainersSection serverId={serverId} token={token} />

        {/* Scan results — detected technologies */}
        {server.scanData && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Algılanan Teknolojiler
              </h3>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {(server.scanData as ScanData).os && <span>{(server.scanData as ScanData).os}</span>}
              </div>
            </div>

            {/* System stats */}
            {((server.scanData as ScanData).ramUsed || (server.scanData as ScanData).diskUsedPct) && (
              <div className="flex flex-wrap gap-3 mb-4">
                {(server.scanData as ScanData).ramUsed && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs">
                    <CpuIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    RAM: {(server.scanData as ScanData).ramUsed} / {(server.scanData as ScanData).ramTotal}
                  </div>
                )}
                {(server.scanData as ScanData).diskUsedPct && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs">
                    <HardDriveIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    Disk: {(server.scanData as ScanData).diskUsedPct}
                  </div>
                )}
                {(server.scanData as ScanData).uptime && (
                  <div className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                    {(server.scanData as ScanData).uptime}
                  </div>
                )}
              </div>
            )}

            {/* Tech badges */}
            {(server.scanData as ScanData).technologies && (server.scanData as ScanData).technologies!.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {(server.scanData as ScanData).technologies!.map((t) => {
                  const colors: Record<string, string> = {
                    Nginx: 'bg-green-500/10 text-green-400 border-green-500/20',
                    PHP: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    'Node.js': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    Docker: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                    PostgreSQL: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                    'MySQL/MariaDB': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    Redis: 'bg-red-500/10 text-red-400 border-red-500/20',
                    Python: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                  };
                  const cls = colors[t.name] ?? 'bg-secondary text-muted-foreground border-border';
                  return (
                    <span key={t.name} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
                      {t.name} <span className="opacity-60">{t.version}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Databases */}
            {(server.scanData as ScanData).databases && (server.scanData as ScanData).databases!.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Veritabanları</p>
                <div className="flex flex-wrap gap-1.5">
                  {(server.scanData as ScanData).databases!.map(db => (
                    <span key={db} className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs text-indigo-400 font-mono">{db}</span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                setActionLoading('scan');
                const res = await fetch(`/api/v1/servers/${serverId}/scan`, { method: 'POST', headers });
                const j = await res.json();
                setActionMsg(res.ok ? '✓ Tarama güncellendi' : `✗ ${j.error}`);
                setActionLoading('');
                if (res.ok) loadServer();
              }}
              disabled={actionLoading === 'scan'}
              className="flex items-center gap-2 mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {actionLoading === 'scan'
                ? <RefreshCwIcon className="h-3 w-3 animate-spin" />
                : <ScanSearchIcon className="h-3 w-3" />}
              Yeniden Tara
            </button>
          </div>
        )}

        {/* No scan data yet */}
        {!server.scanData && (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 flex flex-col items-center gap-3">
            <ScanSearchIcon className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-medium">Teknoloji taraması yapılmadı</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nginx, Docker, veritabanları ve kurulu yazılımları algılamak için tarayın</p>
            </div>
            <button
              onClick={async () => {
                setActionLoading('scan');
                const res = await fetch(`/api/v1/servers/${serverId}/scan`, { method: 'POST', headers });
                const j = await res.json();
                setActionMsg(res.ok ? '✓ Tarama tamamlandı' : `✗ ${j.error}`);
                setActionLoading('');
                if (res.ok) loadServer();
              }}
              disabled={actionLoading === 'scan'}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {actionLoading === 'scan' ? <RefreshCwIcon className="h-4 w-4 animate-spin" /> : <ScanSearchIcon className="h-4 w-4" />}
              Sunucuyu Tara
            </button>
          </div>
        )}

        {/* Actions */}
        {actionMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm ${actionMsg.startsWith('✓') ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-destructive/10 border border-destructive/30 text-destructive'}`}>
            {actionMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={testConnection}
            disabled={actionLoading === 'test'}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-secondary/80 disabled:opacity-60"
          >
            <ZapIcon className="h-4 w-4" />
            {actionLoading === 'test' ? 'Test ediliyor…' : 'Bağlantı Testi'}
          </button>
          <button
            onClick={provisionAgent}
            disabled={actionLoading === 'provision'}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-secondary/80 disabled:opacity-60"
          >
            <ServerIcon className="h-4 w-4" />
            {actionLoading === 'provision' ? 'Kuruluyor…' : 'Agent Kur'}
          </button>
          <button
            onClick={removeServer}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20"
          >
            <TrashIcon className="h-4 w-4" />
            Sunucuyu Sil
          </button>
        </div>
      </div>
      {terminalOpen && server && (
        <TerminalModal
          serverId={server.id}
          serverName={server.name}
          onClose={() => setTerminalOpen(false)}
        />
      )}
    </div>
  );
}
