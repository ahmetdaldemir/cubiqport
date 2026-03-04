import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlusIcon, ServerIcon, Cpu, HardDrive, MemoryStick, WifiIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Server } from '@cubiqport/shared';

export const metadata = { title: 'Servers' };

// In production this would use server-side auth tokens from cookies
async function getServers(): Promise<Server[]> {
  return [];
}

export default async function ServersPage() {
  const servers = await getServers();

  return (
    <div className="flex flex-col">
      <Header title="Servers" description="Manage your infrastructure servers" />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {servers.length} server{servers.length !== 1 ? 's' : ''}
          </p>
          <a
            href="/dashboard/servers/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            Add Server
          </a>
        </div>

        {servers.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <ServerIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No servers yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Add your first server to start managing your infrastructure.
            </p>
            <a
              href="/dashboard/servers/new"
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Add Server
            </a>
          </div>
        ) : (
          /* Server grid */
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {servers.map((server) => (
              <a
                key={server.id}
                href={`/dashboard/servers/${server.id}`}
                className="group block rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <ServerIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold">{server.name}</p>
                      <p className="text-xs text-muted-foreground">{server.ip}</p>
                    </div>
                  </div>
                  <StatusBadge status={server.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { icon: Cpu, label: 'CPU' },
                    { icon: MemoryStick, label: 'RAM' },
                    { icon: HardDrive, label: 'Disk' },
                    { icon: WifiIcon, label: 'Net' },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="ml-auto text-xs font-medium">—</span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Added {formatDate(server.createdAt)}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
