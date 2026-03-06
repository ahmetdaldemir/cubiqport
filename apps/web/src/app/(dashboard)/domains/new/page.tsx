'use client';

import { Suspense, useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, Loader2, GlobeIcon } from 'lucide-react';
import { Header } from '@/components/layout/header';
import type { Server } from '@cubiqport/shared';

function NewDomainForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedServerId = searchParams.get('serverId') ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [servers, setServers] = useState<Server[]>([]);

  const [form, setForm] = useState({
    serverId: preselectedServerId,
    domain: '',
    rootPath: '/var/www',
    port: '3000',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';

  useEffect(() => {
    fetch('/api/v1/servers', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setServers(j.data ?? []))
      .catch(() => {});
  }, [token]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create domain');
      router.push('/domains');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create domain');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Add Domain" description="Configure a domain with automatic DNS, nginx and SSL" />

      <div className="p-6 space-y-6 max-w-2xl">
        <Link
          href="/domains"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Domains
        </Link>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GlobeIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Domain Configuration</h2>
              <p className="text-xs text-muted-foreground">
                CubiqPort will automatically create DNS records and generate nginx config.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Server selector */}
            <div className="space-y-1">
              <label htmlFor="serverId" className="text-sm font-medium">Server</label>
              <select
                id="serverId"
                required
                value={form.serverId}
                onChange={set('serverId')}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a server…</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.ip})
                  </option>
                ))}
              </select>
              {servers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active servers found.{' '}
                  <Link href="/servers/new" className="text-primary hover:underline">
                    Add one first.
                  </Link>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="domain" className="text-sm font-medium">Domain name</label>
                <input
                  id="domain"
                  required
                  value={form.domain}
                  onChange={set('domain')}
                  placeholder="app.example.com"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rootPath" className="text-sm font-medium">Root path</label>
                <input
                  id="rootPath"
                  required
                  value={form.rootPath}
                  onChange={set('rootPath')}
                  placeholder="/var/www"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="port" className="text-sm font-medium">App port</label>
                <input
                  id="port"
                  type="number"
                  min={1}
                  max={65535}
                  required
                  value={form.port}
                  onChange={set('port')}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !form.serverId}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Domain
              </button>
              <Link
                href="/domains"
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-secondary"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Flow explainer */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Automated setup flow</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {[
              'Cloudflare DNS A record created: domain → server IP',
              'Agent writes /etc/nginx/sites-available/<domain>.conf',
              'Nginx config tested (nginx -t) and site enabled via symlink',
              'Nginx reloaded — domain goes live on port 80',
              'Enable SSL from the domain detail page to get a free Let\'s Encrypt cert',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function NewDomainPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <NewDomainForm />
    </Suspense>
  );
}
