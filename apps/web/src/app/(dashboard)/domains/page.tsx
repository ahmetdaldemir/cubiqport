import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlusIcon, GlobeIcon, ShieldCheckIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Domain } from '@cubiqport/shared';

export const metadata = { title: 'Domains' };

async function getDomains(): Promise<Domain[]> {
  return [];
}

export default async function DomainsPage() {
  const domains = await getDomains();

  return (
    <div className="flex flex-col">
      <Header title="Domains" description="Manage domains, nginx configs and SSL certificates" />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {domains.length} domain{domains.length !== 1 ? 's' : ''}
          </p>
          <a
            href="/dashboard/domains/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            Add Domain
          </a>
        </div>

        {domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <GlobeIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No domains yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Add a domain and CubiqPort will automatically configure DNS, nginx and SSL.
            </p>
            <a
              href="/dashboard/domains/new"
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Add Domain
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    SSL
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Port
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {domains.map((d) => (
                  <tr
                    key={d.id}
                    className="transition hover:bg-secondary/30"
                  >
                    <td className="px-5 py-3.5 font-medium">
                      <a
                        href={`/dashboard/domains/${d.id}`}
                        className="flex items-center gap-2 hover:text-primary transition-colors"
                      >
                        <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                        {d.domain}
                      </a>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {d.sslEnabled ? (
                        <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">:{d.port}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{formatDate(d.createdAt)}</td>
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
