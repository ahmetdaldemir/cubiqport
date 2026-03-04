'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, Loader2, ServerIcon } from 'lucide-react';
import { Header } from '@/components/layout/header';

export default function NewServerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    ip: '',
    sshPort: '22',
    sshUser: 'root',
    sshKey: '',
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const token = localStorage.getItem('cubiq_token') ?? '';
    try {
      const res = await fetch('/api/v1/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, sshPort: Number(form.sshPort) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create server');
      router.push('/dashboard/servers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Add Server" description="Connect a new server to CubiqPort" />

      <div className="p-6 space-y-6 max-w-2xl">
        <Link
          href="/dashboard/servers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Servers
        </Link>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ServerIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Server Details</h2>
              <p className="text-xs text-muted-foreground">
                CubiqPort will test the SSH connection and provision the agent automatically.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Server name" id="name" placeholder="prod-web-01">
                <input id="name" required value={form.name} onChange={set('name')}
                  placeholder="prod-web-01"
                  className="input-base" />
              </Field>
              <Field label="IP address" id="ip" placeholder="192.168.1.100">
                <input id="ip" required value={form.ip} onChange={set('ip')}
                  placeholder="203.0.113.42"
                  className="input-base" />
              </Field>
              <Field label="SSH user" id="sshUser">
                <input id="sshUser" required value={form.sshUser} onChange={set('sshUser')}
                  placeholder="root"
                  className="input-base" />
              </Field>
              <Field label="SSH port" id="sshPort">
                <input id="sshPort" type="number" min={1} max={65535} required
                  value={form.sshPort} onChange={set('sshPort')}
                  className="input-base" />
              </Field>
            </div>

            <Field label="SSH private key (PEM)" id="sshKey">
              <textarea
                id="sshKey"
                required
                rows={8}
                value={form.sshKey}
                onChange={set('sshKey')}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The key is encrypted with AES-256-GCM before being stored.
              </p>
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Server
              </button>
              <Link
                href="/dashboard/servers"
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-secondary"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Info box */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">What happens next?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {[
              'CubiqPort tests the SSH connection immediately',
              'Server status is set to "active" on success',
              'Click "Provision Agent" on the server detail page to auto-install Docker, nginx, Certbot and the CubiqPort agent',
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

      {/* Utility class defined inline so Tailwind picks it up */}
      <style jsx global>{`
        .input-base {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--secondary));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
        }
        .input-base:focus {
          ring-width: 2px;
          ring-color: hsl(var(--ring));
          box-shadow: 0 0 0 2px hsl(var(--ring));
        }
        .input-base::placeholder {
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  id,
  placeholder,
  children,
}: {
  label: string;
  id: string;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
