'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  GlobeIcon,
  FolderIcon,
  FileIcon,
  ServerIcon,
  GitBranchIcon,
  MailIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  PlusIcon,
  TrashIcon,
  SaveIcon,
  PlayIcon,
  XIcon,
  ChevronRightIcon,
  NetworkIcon,
  ExternalLinkIcon,
  CopyIcon,
  Loader2,
  FolderOpenIcon,
  FileTextIcon,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Domain {
  id: string; serverId: string; domain: string; rootPath: string; port: number;
  sslEnabled: boolean; status: string; githubRepo?: string; githubBranch?: string;
  deployCommand?: string; webhookSecret?: string; lastDeployAt?: string; deployLog?: string;
}

interface FileEntry {
  name: string; type: 'file' | 'dir' | 'link'; size: number; modified: string; permissions: string;
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'files' | 'dns' | 'subdomains' | 'github' | 'email';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: 'Genel Bakış',  icon: <GlobeIcon className="h-4 w-4" /> },
  { id: 'files',      label: 'Dosyalar',      icon: <FolderIcon className="h-4 w-4" /> },
  { id: 'github',     label: 'GitHub & Deploy', icon: <GitBranchIcon className="h-4 w-4" /> },
  { id: 'dns',        label: 'DNS',           icon: <NetworkIcon className="h-4 w-4" /> },
  { id: 'subdomains', label: 'Subdomainler',  icon: <ServerIcon className="h-4 w-4" /> },
  { id: 'email',      label: 'E-Posta',       icon: <MailIcon className="h-4 w-4" /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-muted-foreground hover:text-foreground transition"
      title="Kopyala"
    >
      {copied ? '✓' : <CopyIcon className="h-3.5 w-3.5 inline" />}
    </button>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ domain, token, reload }: { domain: Domain; token: string; reload: () => void }) {
  const [sslEmail, setSslEmail] = useState('');
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  // Editable fields
  const [editingRoot, setEditingRoot] = useState(false);
  const [editingPort, setEditingPort] = useState(false);
  const [rootPath, setRootPath] = useState(domain.rootPath);
  const [port, setPort] = useState(String(domain.port));

  async function saveField(field: 'rootPath' | 'port') {
    setLoading(field); setMsg('');
    const body = field === 'rootPath'
      ? { rootPath: rootPath.trim() }
      : { port: Number(port) };
    const res = await fetch(`/api/v1/domains/${domain.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (res.ok) {
      setMsg(`✓ ${field === 'rootPath' ? 'Kök dizin' : 'Port'} güncellendi`);
      if (field === 'rootPath') setEditingRoot(false);
      else setEditingPort(false);
      reload();
    } else {
      setMsg(`✗ ${j.error ?? 'Güncelleme başarısız'}`);
    }
    setLoading('');
  }

  async function enableSsl() {
    if (!sslEmail) return;
    setLoading('ssl'); setMsg('');
    const res = await fetch(`/api/v1/domains/${domain.id}/ssl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: sslEmail }),
    });
    const j = await res.json();
    setMsg(res.ok ? '✓ SSL etkinleştirildi' : `✗ ${j.error}`);
    setLoading('');
    if (res.ok) reload();
  }

  async function fixStatus() {
    setLoading('fix'); setMsg('');
    await fetch(`/api/v1/domains/${domain.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'active' }),
    });
    setLoading(''); reload();
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={cn('rounded-lg px-4 py-3 text-sm', msg.startsWith('✓') ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-destructive/10 border border-destructive/30 text-destructive')}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Domain */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Domain</p>
          <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            {domain.domain} <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Status */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Durum</p>
          <div className="text-sm font-semibold"><StatusBadge status={domain.status as 'active' | 'pending' | 'error'} /></div>
        </div>

        {/* Root path — editable */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4 sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kök Dizin</p>
            {!editingRoot && (
              <button
                onClick={() => { setRootPath(domain.rootPath); setEditingRoot(true); setMsg(''); }}
                className="text-xs text-primary hover:underline"
              >
                Düzenle
              </button>
            )}
          </div>
          {editingRoot ? (
            <div className="flex items-center gap-2 mt-1">
              <FolderIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={rootPath}
                onChange={e => setRootPath(e.target.value)}
                placeholder="/var/www/html/example.com"
                className="flex-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') saveField('rootPath'); if (e.key === 'Escape') setEditingRoot(false); }}
                autoFocus
              />
              <button
                onClick={() => saveField('rootPath')}
                disabled={loading === 'rootPath'}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading === 'rootPath' ? <Loader2 className="h-3 w-3 animate-spin" /> : <SaveIcon className="h-3 w-3" />}
                Kaydet
              </button>
              <button onClick={() => setEditingRoot(false)} className="rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-secondary">
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold font-mono flex items-center gap-1.5">
              <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {domain.rootPath}
            </p>
          )}
        </div>

        {/* Port — editable */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Uygulama Portu</p>
            {!editingPort && (
              <button
                onClick={() => { setPort(String(domain.port)); setEditingPort(true); setMsg(''); }}
                className="text-xs text-primary hover:underline"
              >
                Düzenle
              </button>
            )}
          </div>
          {editingPort ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number" min={1} max={65535}
                value={port}
                onChange={e => setPort(e.target.value)}
                className="w-28 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') saveField('port'); if (e.key === 'Escape') setEditingPort(false); }}
                autoFocus
              />
              <button
                onClick={() => saveField('port')}
                disabled={loading === 'port'}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading === 'port' ? <Loader2 className="h-3 w-3 animate-spin" /> : <SaveIcon className="h-3 w-3" />}
                Kaydet
              </button>
              <button onClick={() => setEditingPort(false)} className="rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-secondary">
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold font-mono">:{domain.port}</p>
          )}
        </div>

        {/* SSL */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">SSL</p>
          <div className="text-sm font-semibold">
            {domain.sslEnabled
              ? <span className="flex items-center gap-1 text-green-400 text-xs font-medium"><ShieldCheckIcon className="h-3.5 w-3.5" /> Aktif</span>
              : '—'}
          </div>
        </div>
      </div>

      {domain.status === 'error' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium mb-2">⚠️ Domain kurulumunda hata oluştu</p>
          <p className="text-xs text-muted-foreground mb-3">Cloudflare yapılandırılmamış olabilir veya agent erişilemiyor. Domain nginx üzerinde manuel yapılandırılmışsa durumu aktife alabilirsiniz.</p>
          <button onClick={fixStatus} disabled={loading === 'fix'} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading === 'fix' && <Loader2 className="h-3 w-3 animate-spin" />}
            Durumu Aktife Al
          </button>
        </div>
      )}

      {!domain.sslEnabled && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShieldCheckIcon className="h-4 w-4 text-primary" /> SSL Sertifikası Etkinleştir</h3>
          <div className="flex gap-2">
            <input
              value={sslEmail} onChange={e => setSslEmail(e.target.value)}
              placeholder="admin@ornek.com" type="email"
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={enableSsl} disabled={!sslEmail || loading === 'ssl'} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {loading === 'ssl' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Let&apos;s Encrypt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File Manager Tab ─────────────────────────────────────────────────────────
function FilesTab({ domain, token }: { domain: Domain; token: string }) {
  const [path, setPath] = useState(domain.rootPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editFile, setEditFile] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [showNewDir, setShowNewDir] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadDir = useCallback(async (p: string) => {
    setLoading(true); setMsg('');
    const res = await fetch(`/api/v1/domains/${domain.id}/files?path=${encodeURIComponent(p)}`, { headers });
    const j = await res.json();
    if (res.ok) { setEntries(j.data ?? []); setPath(p); }
    else setMsg(`✗ ${j.error}`);
    setLoading(false);
  }, [domain.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDir(domain.rootPath); }, [loadDir, domain.rootPath]);

  async function openFile(entry: FileEntry) {
    const fp = `${path}/${entry.name}`;
    const res = await fetch(`/api/v1/domains/${domain.id}/files/read?path=${encodeURIComponent(fp)}`, { headers });
    const j = await res.json();
    if (res.ok) setEditFile({ path: fp, content: j.data.content });
    else setMsg(`✗ ${j.error}`);
  }

  async function saveFile() {
    if (!editFile) return;
    setSaving(true);
    const res = await fetch(`/api/v1/domains/${domain.id}/files/write`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: editFile.path, content: editFile.content }),
    });
    const j = await res.json();
    setMsg(res.ok ? '✓ Kaydedildi' : `✗ ${j.error}`);
    setSaving(false);
  }

  async function deleteEntry(entry: FileEntry) {
    if (!confirm(`"${entry.name}" silinsin mi?`)) return;
    const fp = `${path}/${entry.name}`;
    const res = await fetch(`/api/v1/domains/${domain.id}/files?path=${encodeURIComponent(fp)}&recursive=${entry.type === 'dir'}`, {
      method: 'DELETE', headers,
    });
    const j = await res.json();
    if (res.ok) loadDir(path);
    else setMsg(`✗ ${j.error}`);
  }

  async function createDir() {
    if (!newDirName.trim()) return;
    const fp = `${path}/${newDirName.trim()}`;
    const res = await fetch(`/api/v1/domains/${domain.id}/files/mkdir`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fp }),
    });
    if (res.ok) { setNewDirName(''); setShowNewDir(false); loadDir(path); }
    else { const j = await res.json(); setMsg(`✗ ${j.error}`); }
  }

  // Breadcrumb
  const crumbs = path.replace(domain.rootPath, '').split('/').filter(Boolean);

  if (editFile) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setEditFile(null)} className="text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="h-4 w-4" /></button>
          <code className="text-xs bg-secondary px-2 py-1 rounded">{editFile.path}</code>
        </div>
        <button onClick={saveFile} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <SaveIcon className="h-3 w-3" />}
          Kaydet
        </button>
      </div>
      {msg && <div className={cn('text-xs px-3 py-2 rounded', msg.startsWith('✓') ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive')}>{msg}</div>}
      <textarea
        value={editFile.content}
        onChange={e => setEditFile(f => f ? { ...f, content: e.target.value } : null)}
        spellCheck={false}
        className="w-full min-h-[500px] rounded-lg border border-border bg-secondary/50 p-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-y"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {msg && <div className={cn('text-xs px-3 py-2 rounded', msg.startsWith('✓') ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive')}>{msg}<button onClick={() => setMsg('')} className="ml-2"><XIcon className="h-3 w-3 inline" /></button></div>}

      {/* Breadcrumb + toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <button onClick={() => loadDir(domain.rootPath)} className="hover:text-foreground font-mono">{domain.rootPath.split('/').pop()}</button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRightIcon className="h-3 w-3" />
              <button onClick={() => loadDir(domain.rootPath + '/' + crumbs.slice(0, i + 1).join('/'))} className="hover:text-foreground font-mono">{c}</button>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewDir(v => !v)} className="flex items-center gap-1 text-xs rounded-lg border border-border bg-secondary px-2.5 py-1.5 hover:bg-secondary/80">
            <PlusIcon className="h-3.5 w-3.5" /> Klasör
          </button>
          <button onClick={() => loadDir(path)} className="text-xs rounded-lg border border-border bg-secondary px-2.5 py-1.5 hover:bg-secondary/80">
            <RefreshCwIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showNewDir && (
        <div className="flex items-center gap-2">
          <input autoFocus value={newDirName} onChange={e => setNewDirName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createDir()} placeholder="klasör-adı" className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onClick={createDir} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Oluştur</button>
          <button onClick={() => setShowNewDir(false)} className="text-muted-foreground"><XIcon className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Ad</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Boyut</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Değiştirilme</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {path !== domain.rootPath && (
                <tr className="hover:bg-secondary/20 cursor-pointer" onClick={() => loadDir(path.split('/').slice(0, -1).join('/') || domain.rootPath)}>
                  <td className="px-4 py-2.5" colSpan={4}>
                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                      <FolderIcon className="h-4 w-4" /> ..
                    </span>
                  </td>
                </tr>
              )}
              {entries.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">Boş klasör</td></tr>
              )}
              {entries.map(entry => (
                <tr key={entry.name} className="hover:bg-secondary/20 group">
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => entry.type === 'dir' ? loadDir(`${path}/${entry.name}`) : openFile(entry)}
                      className="flex items-center gap-2 font-mono text-xs hover:text-primary transition-colors"
                    >
                      {entry.type === 'dir'
                        ? <FolderOpenIcon className="h-4 w-4 text-yellow-400" />
                        : <FileTextIcon className="h-4 w-4 text-muted-foreground" />}
                      {entry.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    {entry.type === 'file' ? formatBytes(entry.size) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{entry.modified}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => deleteEntry(entry)} className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── GitHub Tab ───────────────────────────────────────────────────────────────
function GithubTab({ domain, token, reload }: { domain: Domain; token: string; reload: () => void }) {
  const [repo, setRepo] = useState(domain.githubRepo ?? '');
  const [branch, setBranch] = useState(domain.githubBranch ?? 'main');
  const [cmd, setCmd] = useState(domain.deployCommand ?? '');
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [log, setLog] = useState(domain.deployLog ?? '');
  const [msg, setMsg] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function save() {
    setSaving(true); setMsg('');
    const res = await fetch(`/api/v1/domains/${domain.id}/github`, {
      method: 'POST', headers,
      body: JSON.stringify({ githubRepo: repo, githubBranch: branch, deployCommand: cmd || undefined }),
    });
    const j = await res.json();
    setMsg(res.ok ? '✓ GitHub bağlantısı kaydedildi' : `✗ ${j.error}`);
    setSaving(false);
    if (res.ok) reload();
  }

  async function deployNow() {
    setDeploying(true); setMsg(''); setLog('Deploy başlatılıyor...\n');
    const res = await fetch(`/api/v1/domains/${domain.id}/deploy`, { method: 'POST', headers });
    const j = await res.json();
    if (res.ok) { setLog(j.data?.log ?? ''); setMsg('✓ Deploy tamamlandı'); reload(); }
    else { setMsg(`✗ ${j.error}`); setLog(j.error ?? ''); }
    setDeploying(false);
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/v1/domains/${domain.id}/webhook?secret=${domain.webhookSecret ?? ''}`
    : '';

  return (
    <div className="space-y-6">
      {msg && <div className={cn('rounded-lg px-4 py-3 text-sm', msg.startsWith('✓') ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-destructive/10 border border-destructive/30 text-destructive')}>{msg}</div>}

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><GitBranchIcon className="h-4 w-4 text-primary" /> GitHub Bağlantısı</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Repository URL</label>
            <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="https://github.com/kullanici/repo.git"
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Branch</label>
              <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main"
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Deploy Komutu (opsiyonel)</label>
              <input value={cmd} onChange={e => setCmd(e.target.value)} placeholder="npm install && npm run build"
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={!repo || saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <SaveIcon className="h-3.5 w-3.5" /> Kaydet
          </button>
          {domain.githubRepo && (
            <button onClick={deployNow} disabled={deploying} className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/20 disabled:opacity-60">
              {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayIcon className="h-3.5 w-3.5" />}
              Deploy Et
            </button>
          )}
        </div>
      </div>

      {domain.webhookSecret && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">🔗 GitHub Webhook</h3>
          <p className="text-xs text-muted-foreground mb-2">Bu URL&apos;yi GitHub → Settings → Webhooks &apos;a ekleyin. Her push&apos;ta otomatik deploy başlar.</p>
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
            <code className="flex-1 text-xs break-all">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Content type: <code>application/json</code></p>
        </div>
      )}

      {log && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
            Deploy Logu
            {domain.lastDeployAt && <span className="text-xs text-muted-foreground font-normal">{new Date(domain.lastDeployAt).toLocaleString('tr-TR')}</span>}
          </h3>
          <pre ref={logRef} className="max-h-64 overflow-auto rounded-lg bg-black/50 p-4 text-xs font-mono text-green-400 whitespace-pre-wrap">{log}</pre>
        </div>
      )}
    </div>
  );
}

// ─── DNS Tab ──────────────────────────────────────────────────────────────────
function DnsTab({ domain }: { domain: Domain }) {
  const serverIp = '—'; // Would need server info
  const records = [
    { type: 'A', name: domain.domain, value: 'sunucu IP', ttl: '—', desc: 'Ana domain → sunucu IP' },
    { type: 'A', name: `www.${domain.domain}`, value: 'sunucu IP', ttl: '—', desc: 'www alt domain → sunucu IP' },
    { type: 'MX', name: domain.domain, value: `mail.${domain.domain}`, ttl: '—', desc: 'E-posta yönlendirme (opsiyonel)' },
    { type: 'TXT', name: domain.domain, value: 'v=spf1 ip4:SUNUCU_IP ~all', ttl: '—', desc: 'SPF kaydı (spam önleme)' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Önerilen DNS Kayıtları</h3>
        <p className="text-xs text-muted-foreground mb-4">Bu kayıtları DNS sağlayıcınıza (Cloudflare, GoDaddy, Namecheap vb.) ekleyin.</p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {['Tip', 'Ad', 'Değer', 'Açıklama'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{r.type}</span></td>
                  <td className="px-4 py-3 font-mono text-xs">{r.name}<CopyButton text={r.name} /></td>
                  <td className="px-4 py-3 font-mono text-xs">{r.value}<CopyButton text={r.value} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-2">Cloudflare Entegrasyonu</h3>
        <p className="text-xs text-muted-foreground">Otomatik DNS yönetimi için <code>CLOUDFLARE_API_TOKEN</code> ve <code>CLOUDFLARE_ZONE_ID</code> değerlerini <code>/var/www/port8083/html/.env</code> dosyasına ekleyin.</p>
      </div>
    </div>
  );
}

// ─── Subdomains Tab ───────────────────────────────────────────────────────────
function SubdomainsTab({ domain, token }: { domain: Domain; token: string }) {
  const [subdomains, setSubdomains] = useState<{ id: string; domain: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/domains?serverId=${domain.serverId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        const all = (j.data ?? []) as { id: string; domain: string; status: string }[];
        setSubdomains(all.filter(d => d.domain !== domain.domain && d.domain.endsWith(`.${domain.domain}`)));
        setLoading(false);
      });
  }, [domain.id, domain.serverId, domain.domain, token]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Yükleniyor…' : `${subdomains.length} subdomain`}
        </p>
        <Link
          href={`/domains/new?serverId=${domain.serverId}&parent=${domain.domain}`}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Subdomain Ekle
        </Link>
      </div>

      {subdomains.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center rounded-xl border border-dashed border-border">
          <NetworkIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Henüz subdomain yok</p>
          <p className="text-xs text-muted-foreground mt-1">Örn: api.{domain.domain}, app.{domain.domain}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subdomains.map(s => (
                <tr key={s.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <Link href={`/domains/${s.id}`} className="flex items-center gap-2 font-mono text-xs hover:text-primary">
                      <GlobeIcon className="h-3.5 w-3.5 text-muted-foreground" />{s.domain}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status as 'active' | 'pending' | 'error'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Subdomain nasıl eklenir?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>"Subdomain Ekle" butonuna tıklayın</li>
          <li>Domain adına <code>api.{domain.domain}</code> gibi bir değer girin</li>
          <li>Subdomain kendi nginx konfig dosyasını ve SSL sertifikasını alır</li>
        </ol>
      </div>
    </div>
  );
}

// ─── Email Tab ────────────────────────────────────────────────────────────────
function EmailTab({ domain }: { domain: Domain }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MailIcon className="h-4 w-4 text-primary" /> E-Posta Yapılandırması</h3>
        <p className="text-xs text-muted-foreground mb-4">E-posta almak için DNS sağlayıcınıza aşağıdaki kayıtları ekleyin:</p>

        {[
          { type: 'MX', name: domain.domain, value: `mail.${domain.domain}`, priority: '10', desc: 'Posta sunucusu' },
          { type: 'A', name: `mail.${domain.domain}`, value: 'SUNUCU_IP', priority: '—', desc: 'Posta sunucusu IP' },
          { type: 'TXT', name: domain.domain, value: 'v=spf1 mx ~all', priority: '—', desc: 'SPF kaydı' },
          { type: 'TXT', name: `_dmarc.${domain.domain}`, value: 'v=DMARC1; p=quarantine; rua=mailto:admin@' + domain.domain, priority: '—', desc: 'DMARC politikası' },
        ].map((r, i) => (
          <div key={i} className="mb-2 rounded-lg border border-border bg-secondary/30 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{r.type}</span>
              <code className="text-xs font-mono">{r.name}</code>
              {r.priority !== '—' && <span className="text-xs text-muted-foreground">Öncelik: {r.priority}</span>}
            </div>
            <code className="text-xs text-muted-foreground break-all">{r.value}</code>
            <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-2">Posta Sunucusu Kurulumu</h3>
        <p className="text-xs text-muted-foreground mb-3">Sunucunuza e-posta sunucusu kurmak için:</p>
        <div className="rounded-lg bg-black/50 p-4 font-mono text-xs text-green-400 space-y-1">
          <p># Postfix + Dovecot kurulumu</p>
          <p>apt-get install -y postfix dovecot-core dovecot-imapd</p>
          <p># Ya da daha kolay seçenek:</p>
          <p>apt-get install -y mailutils</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">💡 Önerimiz: Posta yönetimi için <a href="https://mailu.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mailu.io</a> veya <a href="https://mailcow.email" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mailcow</a> kullanın.</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();
  const token = useToken();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/domains/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Not found');
      setDomain(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex flex-col">
      <Header title="Domain Yönetimi" description="Yükleniyor…" />
      <div className="p-6 space-y-4">{[1, 2].map(i => <div key={i} className="rounded-xl border border-border bg-card h-32 animate-pulse" />)}</div>
    </div>
  );

  if (error || !domain) return (
    <div className="flex flex-col">
      <Header title="Hata" description="" />
      <div className="p-6">
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error || 'Domain bulunamadı'}</div>
        <Link href="/domains" className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="h-4 w-4" /> Geri</Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header title={domain.domain} description={domain.rootPath} />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/domains" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="h-4 w-4" /> Domainler
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={domain.status as 'active' | 'pending' | 'error'} />
            <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <ExternalLinkIcon className="h-3.5 w-3.5" /> Aç
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {tab === 'overview'   && <OverviewTab   domain={domain} token={token} reload={load} />}
          {tab === 'files'      && <FilesTab      domain={domain} token={token} />}
          {tab === 'github'     && <GithubTab     domain={domain} token={token} reload={load} />}
          {tab === 'dns'        && <DnsTab        domain={domain} />}
          {tab === 'subdomains' && <SubdomainsTab domain={domain} token={token} />}
          {tab === 'email'      && <EmailTab      domain={domain} />}
        </div>
      </div>
    </div>
  );
}
