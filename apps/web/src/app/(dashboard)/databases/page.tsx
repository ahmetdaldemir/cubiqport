'use client';

import { useEffect, useState, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  PlusIcon,
  DatabaseIcon,
  RefreshCwIcon,
  MoreVerticalIcon,
  RotateCcwIcon,
  KeyIcon,
  TrashIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestDatabase {
  id: string;
  serverId: string | null;
  type: 'postgres' | 'mysql' | 'mongo';
  name: string;
  host: string;
  port: number;
  databaseName: string;
  storageLimitMb: number;
  storageUsedMb: number | null;
  status: 'creating' | 'running' | 'stopped' | 'error';
  containerName: string | null;
  createdAt: string;
}

interface ConnectionDetails {
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
}

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

// ─── Create Database Modal (demo: 50 MB on platform server) ─────────────────────
function CreateModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void;
  onCreate: (body: { type: 'postgres' | 'mysql'; name: string }) => Promise<void>;
  loading: boolean;
}) {
  const [type, setType] = useState<'postgres' | 'mysql'>('postgres');
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate({ type, name: name.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold">Create Demo Database</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Test database on our platform — 50 MB limit, PostgreSQL or MySQL.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Database Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'postgres' | 'mysql')}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Database name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_app_db"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              maxLength={100}
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Connection Info Modal ─────────────────────────────────────────────────────
function ConnectionModal({ details, onClose }: { details: ConnectionDetails; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const fields = [
    { label: 'Host', value: details.host },
    { label: 'Port', value: String(details.port) },
    { label: 'Username', value: details.username },
    { label: 'Password', value: details.password },
    { label: 'Database', value: details.databaseName },
  ];

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold">Connection details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Use these credentials to connect. Copy and store securely.</p>
        <div className="space-y-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{label}</span>
              <code className="flex-1 truncate rounded bg-secondary px-2 py-1.5 text-sm">{value}</code>
              <button
                type="button"
                onClick={() => copy(value, label)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Copy"
              >
                {copied === label ? <CheckIcon className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-semibold mb-2">Delete database</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Delete &quot;{name}&quot;? The container and data will be removed. This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading && <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action menu ───────────────────────────────────────────────────────────────
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-border bg-card shadow-lg">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DatabasesPage() {
  const [list, setList] = useState<TestDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestDatabase | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [banner, setBanner] = useState<{ msg: string; ok: boolean } | null>(null);
  const token = useToken();
  const headers = { Authorization: `Bearer ${token}` };

  async function load() {
    setLoading(true);
    setError('');
    try {
      const resList = await fetch('/api/v1/databases', { headers });
      const jsonList = await resList.json();
      if (!resList.ok) throw new Error(jsonList.error ?? 'Failed to load databases');
      setList(jsonList.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(body: { type: 'postgres' | 'mysql'; name: string }) {
    setCreateLoading(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/databases', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Create failed');
      setBanner({ msg: 'Demo database created (50 MB).', ok: true });
      await load();
    } catch (e) {
      setBanner({ msg: e instanceof Error ? e.message : 'Create failed', ok: false });
    } finally {
      setCreateLoading(false);
    }
  }

  async function fetchConnection(id: string) {
    try {
      const res = await fetch(`/api/v1/databases/${id}/connection`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load connection');
      setConnectionDetails(json.data);
    } catch (e) {
      setBanner({ msg: e instanceof Error ? e.message : 'Failed to load connection', ok: false });
    }
  }

  async function restartDb(db: TestDatabase) {
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/databases/${db.id}/restart`, { method: 'POST', headers });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Restart failed');
      }
      setBanner({ msg: `${db.name} restarted.`, ok: true });
      await load();
    } catch (e) {
      setBanner({ msg: e instanceof Error ? e.message : 'Restart failed', ok: false });
    }
  }

  async function resetPassword(db: TestDatabase) {
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/databases/${db.id}/reset-password`, { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Reset failed');
      setConnectionDetails(json.data);
      setBanner({ msg: 'Password reset. New credentials shown below.', ok: true });
    } catch (e) {
      setBanner({ msg: e instanceof Error ? e.message : 'Reset failed', ok: false });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/databases/${deleteTarget.id}`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) {
        setBanner({ msg: `${deleteTarget.name} deleted.`, ok: true });
        setDeleteTarget(null);
        await load();
      } else {
        const json = await res.json();
        setBanner({ msg: json.error ?? 'Delete failed', ok: false });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const typeLabel: Record<string, string> = { postgres: 'PostgreSQL', mysql: 'MySQL', mongo: 'MongoDB' };
  // Only postgres/mysql are offered now; mongo kept for existing rows

  return (
    <div className="flex flex-col">
      <Header title="Databases" description="Demo databases on our platform — 50 MB, PostgreSQL and MySQL only" />

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          loading={createLoading}
        />
      )}
      {connectionDetails && (
        <ConnectionModal details={connectionDetails} onClose={() => setConnectionDetails(null)} />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          name={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${list.length} database(s)`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              title="Refresh"
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/80"
            >
              <RefreshCwIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Create Database
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={cn(
              'flex items-center justify-between rounded-lg px-4 py-3 text-sm',
              banner.ok
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-destructive/10 border border-destructive/30 text-destructive',
            )}
          >
            {banner.msg}
            <button onClick={() => setBanner(null)}>
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
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse h-36" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <DatabaseIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No databases yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Create a demo database (50 MB) on our platform — PostgreSQL or MySQL.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Create Database
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Storage</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((db) => (
                  <tr key={db.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{db.name}</span>
                      <span className="block text-xs text-muted-foreground">{db.host}:{db.port}</span>
                    </td>
                    <td className="px-4 py-3">{typeLabel[db.type] ?? db.type}</td>
                    <td className="px-4 py-3">
                      {db.storageUsedMb != null ? `${db.storageUsedMb} MB` : '—'} / {db.storageLimitMb} MB
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={db.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionMenu
                        actions={[
                          {
                            label: 'Connection Info',
                            icon: <KeyIcon className="h-4 w-4" />,
                            onClick: () => fetchConnection(db.id),
                          },
                          {
                            label: 'Restart',
                            icon: <RotateCcwIcon className="h-4 w-4" />,
                            onClick: () => restartDb(db),
                          },
                          {
                            label: 'Reset Password',
                            icon: <KeyIcon className="h-4 w-4" />,
                            onClick: () => resetPassword(db),
                          },
                          {
                            label: 'Delete',
                            icon: <TrashIcon className="h-4 w-4" />,
                            danger: true,
                            onClick: () => setDeleteTarget(db),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
