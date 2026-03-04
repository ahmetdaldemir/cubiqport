import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { ServerIcon, GlobeIcon, RocketIcon, ActivityIcon } from 'lucide-react';

export const metadata = { title: 'Overview' };

// Server-side data fetch (placeholder — in production, use server actions + auth cookies)
async function getStats() {
  return {
    servers: 0,
    domains: 0,
    deployments: 0,
    activeAlerts: 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="flex flex-col">
      <Header title="Overview" description="Welcome to your CubiqPort control panel" />

      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Servers"
            value={stats.servers}
            subtitle="Managed servers"
            icon={ServerIcon}
          />
          <StatCard
            title="Domains"
            value={stats.domains}
            subtitle="Active domains"
            icon={GlobeIcon}
          />
          <StatCard
            title="Deployments"
            value={stats.deployments}
            subtitle="All time"
            icon={RocketIcon}
          />
          <StatCard
            title="Active Alerts"
            value={stats.activeAlerts}
            subtitle="Requires attention"
            icon={ActivityIcon}
          />
        </div>

        {/* Getting started */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-base font-semibold">Getting started</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Follow these steps to set up your first server and deploy your first application.
          </p>
          <ol className="space-y-3">
            {[
              { step: '1', title: 'Add a server', desc: 'Provide SSH credentials and CubiqPort will automatically provision it.', href: '/dashboard/servers' },
              { step: '2', title: 'Create a domain', desc: 'Point your domain to the server — DNS, nginx and SSL are configured automatically.', href: '/dashboard/domains' },
              { step: '3', title: 'Deploy an application', desc: 'Connect a Git repository and trigger your first deployment.', href: '/dashboard/deployments' },
            ].map(({ step, title, desc, href }) => (
              <li key={step} className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {step}
                </div>
                <div>
                  <a href={href} className="text-sm font-medium hover:text-primary transition-colors">
                    {title} →
                  </a>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
