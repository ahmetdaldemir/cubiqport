'use client';

import { useEffect, useState, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  PlusIcon,
  ServerIcon,
  RefreshCwIcon,
  MoreVerticalIcon,
  Power,
  RotateCcw,
  HardDriveIcon,
  ZapIcon,
  TrashIcon,
  XIcon,
  GlobeIcon,
  ScanSearchIcon,
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import type { Server } from '@cubiqport/shared';

interface ServerWithCount extends Server {
  domainCount: number;
}

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  requireTyping?: string;    // user must type this exact string to confirm
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  title, description, confirmLabel, danger, requireTyping, loading, onConfirm, onCancel,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = requireTyping ? typed === requireTyping : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        {requireTyping && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1.5">
              Onaylamak için <span className="font-mono font-semibold text-foreground">{requireTyping}</span> yazın:
            </p>
            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={requireTyping}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
              danger
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {loading && <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────
interface Action {
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

function ActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-border bg-card shadow-lg">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); a.onClick(); }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-secondary first:rounded-t-xl last:rounded-b-xl',
                a.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dialog state ─────────────────────────────────────────────────────────────
type DialogType = 'reboot' | 'shutdown' | 'reinstall' | 'delete';

interface DialogState {
  type: DialogType;
  server: ServerWithCount;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ServersPage() {
  const [servers, setServers] = useState<ServerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ msg: string; ok: boolean } | null>(null);
  const token = useToken();

  const headers = { Authorization: `Bearer ${token}` };

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/servers', { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load servers');
      setServers(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAction(serverId: string, endpoint: string, body?: object) {
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}${endpoint}`, {
        method: endpoint === '' ? 'DELETE' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      return { ok: true, data: json.data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Action failed' };
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirm() {
    if (!dialog) return;
    const { type, server } = dialog;

    let result: { ok: boolean; error?: string; data?: unknown };

    if (type === 'reboot') {
      result = await runAction(server.id, '/reboot');
      if (result.ok) {
        setActionResult({ msg: `✓ ${server.name} yeniden başlatılıyor…`, ok: true });
        setServers(sv => sv.map(s => s.id === server.id ? { ...s, status: 'offline' } : s));
      } else {
        setActionResult({ msg: `✗ ${result.error}`, ok: false });
      }
    }

    if (type === 'shutdown') {
      result = await runAction(server.id, '/shutdown');
      if (result.ok) {
        setActionResult({ msg: `✓ ${server.name} kapatılıyor…`, ok: true });
        setServers(sv => sv.map(s => s.id === server.id ? { ...s, status: 'offline' } : s));
      } else {
        setActionResult({ msg: `✗ ${result.error}`, ok: false });
      }
    }

    if (type === 'reinstall') {
      result = await runAction(server.id, '/reinstall-stack', { confirm: server.name });
      if (result.ok) {
        setActionResult({ msg: `✓ ${server.name} stack yeniden kuruldu.`, ok: true });
        await load();
      } else {
        setActionResult({ msg: `✗ ${result.error}`, ok: false });
      }
    }

    if (type === 'delete') {
      const res = await fetch(`/api/v1/servers/${server.id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok || res.status === 204) {
        setActionResult({ msg: `✓ ${server.name} silindi.`, ok: true });
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        setActionResult({ msg: `✗ ${j.error ?? 'Silinemedi'}`, ok: false });
      }
    }

    setDialog(null);
  }

  function openDialog(type: DialogType, server: ServerWithCount) {
    setActionResult(null);
    setDialog({ type, server });
  }

  const dialogConfig: Record<DialogType, Omit<ConfirmModalProps, 'onConfirm' | 'onCancel' | 'loading'>> = {
    reboot: {
      title: 'Sunucuyu Yeniden Başlat',
      description: 'Sunucu birkaç saniye içinde yeniden başlayacak. Aktif bağlantılar kesilecek.',
      confirmLabel: 'Yeniden Başlat',
      danger: false,
    },
    shutdown: {
      title: 'Sunucuyu Kapat',
      description: '⚠️ Sunucu tamamen kapanacak. Uzaktan tekrar açmak için hosting panelini kullanman gerekecek.',
      confirmLabel: 'Kapat',
      danger: true,
      requireTyping: dialog?.server.name,
    },
    reinstall: {
      title: 'Stack Yeniden Kur (Sıfırla)',
      description: '⚠️ Tüm Docker konteynerleri silinecek, nginx yapılandırmaları kaldırılacak ve sistem baştan kurulacak. Bu işlem 2-5 dakika sürebilir.',
      confirmLabel: 'Yeniden Kur',
      danger: true,
      requireTyping: dialog?.server.name,
    },
    delete: {
      title: 'Sunucuyu Sil',
      description: 'Bu sunucu CubiqPort\'tan kaldırılacak. Sunucunun kendisi etkilenmez.',
      confirmLabel: 'Sil',
      danger: true,
      requireTyping: dialog?.server.name,
    },
  };

  return (
    <div className="flex flex-col">
      <Header title="Servers" description="Manage your infrastructure servers" />

      {/* Confirmation dialog */}
      {dialog && (
        <ConfirmModal
          {...dialogConfig[dialog.type]}
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={() => setDialog(null)}
        />
      )}

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Yükleniyor…' : `${servers.length} sunucu`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              title="Yenile"
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-secondary/80"
            >
              <RefreshCwIcon className="h-4 w-4" />
            </button>
            <a
              href="/servers/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Sunucu Ekle
            </a>
          </div>
        </div>

        {/* Action result banner */}
        {actionResult && (
          <div
            className={cn(
              'flex items-center justify-between rounded-lg px-4 py-3 text-sm',
              actionResult.ok
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-destructive/10 border border-destructive/30 text-destructive',
            )}
          >
            {actionResult.msg}
            <button onClick={() => setActionResult(null)}>
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse h-36" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <ServerIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Henüz sunucu yok</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              İlk sunucunu ekleyerek altyapını yönetmeye başla.
            </p>
            <a
              href="/servers/new"
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Sunucu Ekle
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {servers.map(server => (
              <div
                key={server.id}
                className="group relative rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <a href={`/servers/${server.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <ServerIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{server.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{server.ip}</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-1.5 ml-2">
                    <StatusBadge status={server.status} />
                    <ActionMenu
                      actions={[
                        {
                          label: 'Detaylar',
                          icon: <ServerIcon className="h-4 w-4" />,
                          onClick: () => window.location.href = `/servers/${server.id}`,
                        },
                        {
                          label: 'Yeniden Başlat',
                          icon: <RotateCcw className="h-4 w-4" />,
                          onClick: () => openDialog('reboot', server),
                        },
                        {
                          label: 'Bağlantıyı Test Et',
                          icon: <ZapIcon className="h-4 w-4" />,
                          onClick: async () => {
                            const r = await runAction(server.id, '/test-connection');
                            setActionResult({
                              msg: r.ok ? `✓ ${server.name} bağlantısı başarılı` : `✗ ${r.error}`,
                              ok: r.ok ?? false,
                            });
                            if (r.ok) await load();
                          },
                        },
                        {
                          label: 'Domain Tara & İçe Aktar',
                          icon: <ScanSearchIcon className="h-4 w-4" />,
                          onClick: async () => {
                            setActionResult(null);
                            const r = await runAction(server.id, '/scan-domains');
                            if (r.ok) {
                              const d = r.data as { scanned: number; results: { domain: string; status: string }[] };
                              const imported = d.results.filter(x => x.status === 'imported').length;
                              setActionResult({
                                msg: `✓ ${d.scanned} domain tarandı, ${imported} yeni eklendi: ${d.results.map(x => x.domain).join(', ')}`,
                                ok: true,
                              });
                              await load();
                            } else {
                              setActionResult({ msg: `✗ ${r.error}`, ok: false });
                            }
                          },
                        },
                        {
                          label: 'Stack Yeniden Kur',
                          icon: <HardDriveIcon className="h-4 w-4" />,
                          danger: true,
                          onClick: () => openDialog('reinstall', server),
                        },
                        {
                          label: 'Kapat',
                          icon: <Power className="h-4 w-4" />,
                          danger: true,
                          onClick: () => openDialog('shutdown', server),
                        },
                        {
                          label: 'Sil',
                          icon: <TrashIcon className="h-4 w-4" />,
                          danger: true,
                          onClick: () => openDialog('delete', server),
                        },
                      ]}
                    />
                  </div>
                </div>

                {/* Info row */}
                <a href={`/servers/${server.id}`}>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {server.sshUser}@{server.ip}:{server.sshPort ?? 22}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <GlobeIcon className="h-3 w-3" />
                      {server.domainCount} domain
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Eklendi {formatDate(server.createdAt)}
                  </p>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
