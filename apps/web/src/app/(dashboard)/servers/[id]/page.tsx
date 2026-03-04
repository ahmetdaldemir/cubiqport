import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ServerIcon, ArrowLeftIcon, ContainerIcon } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Server Details' };

interface Props {
  params: { id: string };
}

export default async function ServerDetailPage({ params }: Props) {
  // In production, fetch server + live metrics server-side using auth cookie token
  const serverId = params.id;

  return (
    <div className="flex flex-col">
      <Header title="Server Details" description={`Server ID: ${serverId}`} />

      <div className="p-6 space-y-6">
        <Link
          href="/dashboard/servers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Servers
        </Link>

        {/* Server card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <ServerIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Server</h2>
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            </div>
            <StatusBadge status="pending" />
          </div>
        </div>

        {/* Live metrics */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Live Metrics
          </h3>
          <div className="flex flex-wrap items-center gap-8 justify-around">
            <ProgressRing value={0} label="CPU" />
            <ProgressRing value={0} label="RAM" />
            <ProgressRing value={0} label="Disk" />
            <ProgressRing value={0} label="Net I/O" />
          </div>
        </div>

        {/* Containers */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Running Containers
          </h3>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ContainerIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No containers running</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-secondary/80">
            Test Connection
          </button>
          <button className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-secondary/80">
            Provision Agent
          </button>
          <button className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20">
            Remove Server
          </button>
        </div>
      </div>
    </div>
  );
}
