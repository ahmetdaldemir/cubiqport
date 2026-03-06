'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  Loader2,
  ServerIcon,
  LockIcon,
  KeyIcon,
  CheckCircleIcon,
  ScanSearchIcon,
  WifiIcon,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';

type AuthMode = 'password' | 'key';

type Step = 'form' | 'connecting' | 'scanning' | 'done';

interface ScanTech {
  name: string;
  version: string;
  status: string;
}

function TechBadge({ tech }: { tech: ScanTech }) {
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
  const cls = colors[tech.name] ?? 'bg-secondary text-muted-foreground border-border';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', cls)}>
      {tech.name}
      <span className="opacity-70">{tech.version}</span>
    </span>
  );
}

export default function NewServerPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [stepMsg, setStepMsg] = useState('');
  const [scanResult, setScanResult] = useState<{
    os?: string; technologies?: ScanTech[]; nginxDomains?: string[]; databases?: string[];
  } | null>(null);
  const [createdId, setCreatedId] = useState('');

  const [form, setForm] = useState({
    name: '',
    ip: '',
    sshPort: '22',
    sshUser: 'root',
    sshPassword: '',
    sshKey: '',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStep('connecting');
    setStepMsg('Sunucuya bağlanılıyor…');

    try {
      const body = {
        name: form.name,
        ip: form.ip,
        sshPort: Number(form.sshPort),
        sshUser: form.sshUser,
        sshAuthType: authMode,
        ...(authMode === 'password' ? { sshPassword: form.sshPassword } : { sshKey: form.sshKey }),
      };

      const res = await fetch('/api/v1/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Sunucu eklenemedi');

      const serverId = json.data.id;
      setCreatedId(serverId);
      setStep('scanning');
      setStepMsg('Sunucu bağlantısı test ediliyor ve taranıyor…');

      // Wait a moment for background scan to complete
      await new Promise(r => setTimeout(r, 6000));

      // Fetch updated server with scan data
      const sRes = await fetch(`/api/v1/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sJson = await sRes.json();
      if (sRes.ok && sJson.data?.scanData) {
        setScanResult(sJson.data.scanData);
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
      setStep('form');
    }
  }

  // ─── Connecting / Scanning screen ────────────────────────────────────────────
  if (step === 'connecting' || step === 'scanning') {
    return (
      <div className="flex flex-col">
        <Header title="Sunucu Ekleniyor" description={stepMsg} />
        <div className="p-6 flex flex-col items-center justify-center py-20 gap-6">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {step === 'connecting'
                ? <WifiIcon className="h-8 w-8 text-primary" />
                : <ScanSearchIcon className="h-8 w-8 text-primary animate-pulse" />}
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold">{step === 'connecting' ? 'Bağlanıyor…' : 'Teknolojiler Taranıyor…'}</p>
            <p className="text-sm text-muted-foreground">
              {step === 'scanning'
                ? 'Nginx, Docker, veritabanları ve kurulu yazılımlar algılanıyor'
                : `${form.ip}:${form.sshPort} adresine ${authMode === 'password' ? 'şifre' : 'SSH anahtarı'} ile bağlanılıyor`}
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            {['Bağlantı', 'Tarama', 'Domain Aktarımı'].map((s, i) => (
              <div key={s} className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border',
                (step === 'connecting' && i === 0) || (step === 'scanning' && i <= 1)
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-secondary text-muted-foreground border-border',
              )}>
                {((step === 'scanning' && i === 0)) && <CheckCircleIcon className="h-3 w-3" />}
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Done screen ─────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col">
        <Header title="Sunucu Eklendi" description="Bağlantı ve tarama tamamlandı" />
        <div className="p-6 max-w-2xl space-y-6">
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
            <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Sunucu başarıyla eklendi!</h2>
            <p className="text-sm text-muted-foreground">
              {form.name} ({form.ip}) sisteme eklendi ve tarama tamamlandı.
            </p>
          </div>

          {scanResult && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ScanSearchIcon className="h-4 w-4 text-primary" />
                Algılanan Teknolojiler
              </h3>

              {scanResult.os && (
                <p className="text-xs text-muted-foreground">İşletim sistemi: <span className="text-foreground font-medium">{scanResult.os}</span></p>
              )}

              {scanResult.technologies && scanResult.technologies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {scanResult.technologies.map((t) => <TechBadge key={t.name} tech={t} />)}
                </div>
              )}

              {scanResult.nginxDomains && scanResult.nginxDomains.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Bulunan Domainler ({scanResult.nginxDomains.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scanResult.nginxDomains.map(d => (
                      <span key={d} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-mono">{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {scanResult.databases && scanResult.databases.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Bulunan Veritabanları ({scanResult.databases.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scanResult.databases.map(d => (
                      <span key={d} className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs text-indigo-400 font-mono">{d}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href={`/servers/${createdId}`}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <ServerIcon className="h-4 w-4" />
              Sunucu Detayına Git
            </Link>
            <Link
              href="/servers"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              Sunucu Listesi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      <Header title="Sunucu Ekle" description="Altyapınıza yeni bir sunucu bağlayın" />

      <div className="p-6 space-y-6 max-w-2xl">
        <Link href="/servers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="h-4 w-4" /> Sunuculara Dön
        </Link>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ServerIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Sunucu Bilgileri</h2>
              <p className="text-xs text-muted-foreground">Bağlanıldıktan sonra sunucu otomatik taranır.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium">Sunucu Adı</label>
                <input required value={form.name} onChange={set('name')} placeholder="web-sunucu-1"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">IP Adresi</label>
                <input required value={form.ip} onChange={set('ip')} placeholder="203.0.113.42"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">SSH Kullanıcısı</label>
                <input required value={form.sshUser} onChange={set('sshUser')} placeholder="root"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium">SSH Port</label>
                <input type="number" min={1} max={65535} required value={form.sshPort} onChange={set('sshPort')}
                  className="w-full sm:w-40 rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {/* Auth mode toggle */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Bağlantı Yöntemi</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition',
                    authMode === 'password'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-secondary/80',
                  )}
                >
                  <LockIcon className="h-4 w-4" /> Şifre ile Bağlan
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('key')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition',
                    authMode === 'key'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-secondary/80',
                  )}
                >
                  <KeyIcon className="h-4 w-4" /> SSH Anahtarı
                </button>
              </div>

              {authMode === 'password' ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Root / Kullanıcı Şifresi</label>
                  <input
                    type="password"
                    required={authMode === 'password'}
                    value={form.sshPassword}
                    onChange={set('sshPassword')}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">Şifre AES-256 ile şifrelenip saklanır.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-medium">SSH Özel Anahtarı (PEM)</label>
                  <textarea
                    required={authMode === 'key'}
                    rows={7}
                    value={form.sshKey}
                    onChange={set('sshKey')}
                    placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">Anahtar AES-256 ile şifrelenip saklanır.</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <WifiIcon className="h-4 w-4" />
              Bağlan ve Tara
            </button>
          </form>
        </div>

        {/* What happens */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Ne olacak?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {[
              'SSH bağlantısı test edilir',
              'Sunucu otomatik taranır: Nginx, Docker, PHP, Node.js, veritabanları algılanır',
              'Mevcut domainler otomatik içe aktarılır',
              'Tüm bulgular sunucu detay sayfasında gösterilir',
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
