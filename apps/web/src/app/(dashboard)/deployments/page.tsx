import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlusIcon, RocketIcon, GitBranchIcon, ClockIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Deployment } from '@cubiqport/shared';

export const metadata = { title: 'Deployments' };

async function getDeployments(): Promise<Deployment[]> {
  return [];
}

export default async function DeploymentsPage() {
  const deployments = await getDeployments();

  return (
    <div className="flex flex-col">
      <Header title="Deployments" description="Track and manage application deployments" />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {deployments.length} deployment{deployments.length !== 1 ? 's' : ''}
          </p>
          <a
            href="/dashboard/deployments/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            New Deployment
          </a>
        </div>

        {deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <RocketIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No deployments yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Deploy your first application from a Git repository.
            </p>
            <a
              href="/dashboard/deployments/new"
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              New Deployment
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {deployments.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition hover:border-border/80"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <RocketIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{d.repository}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranchIcon className="h-3 w-3" />
                        {d.branch}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ClockIcon className="h-3 w-3" />
                        {formatDate(d.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
