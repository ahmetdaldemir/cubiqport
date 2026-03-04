'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ServerIcon,
  GlobeIcon,
  RocketIcon,
  ActivityIcon,
  NetworkIcon,
  LogOutIcon,
  LayoutDashboardIcon,
  ShieldIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboardIcon },
  { href: '/dashboard/servers', label: 'Servers', icon: ServerIcon },
  { href: '/dashboard/domains', label: 'Domains', icon: GlobeIcon },
  { href: '/dashboard/deployments', label: 'Deployments', icon: RocketIcon },
  { href: '/dashboard/dns', label: 'DNS', icon: NetworkIcon },
  { href: '/dashboard/monitoring', label: 'Monitoring', icon: ActivityIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('cubiq_token');
    router.push('/login');
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <ShieldIcon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-base font-bold tracking-tight">CubiqPort</span>
      </div>

      <div className="mx-3 mb-2 h-px bg-border" />

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOutIcon className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
