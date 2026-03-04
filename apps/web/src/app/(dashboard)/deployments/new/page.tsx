'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, Loader2, RocketIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { Header } from '@/components/layout/header';
import type { Domain } from '@cubiqport/shared';

export default function NewDeploymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  const [form, setForm] = useState({
    domainId: '',
    repository: '',
    branch: 'main',
    buildCommand: '',
    startCommand: '',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';

  useEffect(() => {
    fetch('/api/v1/domains', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setDomains((j.data ?? []).filter((d: Domain) => d.status === 'active')))
      .catch(() => {});
  }, [token]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function addEnvVar() {
    setEnvVars((v) => [...v, { key: '', value: '' }]);
  }

  function removeEnvVar(i: number) {
    setEnvVars((v) => v.filter((_, idx) => idx !== i));
  }

  function setEnvVar(i: number, field: 'key' | 'value', val: string) {
    setEnvVars((v) => v.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const envVarsObj = envVars.reduce<Record<string, string>>((acc, { key, value }) => {
      if (key) acc[key] = value;
      return acc;
    }, {});

    try {
      const res = await fetch('/api/v1/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          buildCommand: form.buildCommand || undefined,
          startCommand: form.startCommand || undefined,
          envVars: Object.keys(envVarsObj).length ? envVarsObj : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create deployment');
      router.push('/dashboard/deployments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deployment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="New Deployment" description="Deploy an application from a Git repository" />

      <div className="p-6 space-y-6 max-w-2xl">
        <Link
          href="/dashboard/deployments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Deployments
        </Link>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <RocketIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Deployment Configuration</h2>
              <p className="text-xs text-muted-foreground">
                The agent will clone the repo, build and start a Docker container.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Domain */}
            <div className="space-y-1">
              <label htmlFor="domainId" className="text-sm font-medium">Target domain</label>
              <select
                id="domainId"
                required
                value={form.domainId}
                onChange={set('domainId')}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select an active domain…</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.domain}</option>
                ))}
              </select>
              {domains.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active domains.{' '}
                  <Link href="/dashboard/domains/new" className="text-primary hover:underline">Add one first.</Link>
                </p>
              )}
            </div>

            {/* Repo + branch */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="repository" className="text-sm font-medium">Repository URL</label>
                <input
                  id="repository"
                  type="url"
                  required
                  value={form.repository}
                  onChange={set('repository')}
                  placeholder="https://github.com/user/repo"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="branch" className="text-sm font-medium">Branch</label>
                <input
                  id="branch"
                  required
                  value={form.branch}
                  onChange={set('branch')}
                  placeholder="main"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Commands */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="buildCommand" className="text-sm font-medium">
                  Build command <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="buildCommand"
                  value={form.buildCommand}
                  onChange={set('buildCommand')}
                  placeholder="npm run build"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="startCommand" className="text-sm font-medium">
                  Start command <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="startCommand"
                  value={form.startCommand}
                  onChange={set('startCommand')}
                  placeholder="node dist/server.js"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Environment variables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Environment variables</label>
                <button
                  type="button"
                  onClick={addEnvVar}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add variable
                </button>
              </div>
              {envVars.length === 0 ? (
                <p className="text-xs text-muted-foreground">No environment variables configured.</p>
              ) : (
                <div className="space-y-2">
                  {envVars.map((ev, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={ev.key}
                        onChange={(e) => setEnvVar(i, 'key', e.target.value)}
                        placeholder="KEY"
                        className="w-40 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span className="text-muted-foreground">=</span>
                      <input
                        value={ev.value}
                        onChange={(e) => setEnvVar(i, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvVar(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !form.domainId}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Deploy
              </button>
              <Link
                href="/dashboard/deployments"
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-secondary"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
