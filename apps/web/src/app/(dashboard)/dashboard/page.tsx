'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { ServerIcon, GlobeIcon, ActivityIcon, CheckCircleIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

interface Stats {
  totalServers: number;
  activeServers: number;
  totalDomains: number;
  activeDomains: number;
}

export default function DashboardPage() {
  const token = useToken();
  const [stats, setStats] = useState<Stats>({ totalServers: 0, activeServers: 0, totalDomains: 0, activeDomains: 0 });
  const [loading, setLoading] = useState(true);
  const [recentServers, setRecentServers] = useState<{ id: string; name: string; ip: string; status: string; domainCount?: number }[]>([]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/v1/servers', { headers }).then(r => r.json()),
      fetch('/api/v1/domains', { headers }).then(r => r.json()),
    ]).then(([serversJson, domainsJson]) => {
      const serverList = serversJson.data ?? [];
      const domainList = domainsJson.data ?? [];
      setStats({
        totalServers: serverList.length,
        activeServers: serverList.filter((s: { status: string }) => s.status === 'active').length,
        totalDomains: domainList.length,
        activeDomains: domainList.filter((d: { status: string }) => d.status === 'active').length,
      });
      setRecentServers(serverList.slice(0, 5));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-col">
      <Header title="Genel Bakış" description="CubiqPort kontrol panelinize hoş geldiniz" />

      <div className="p-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Toplam Sunucu"
            value={loading ? '—' : stats.totalServers}
            subtitle={loading ? 'Yükleniyor…' : `${stats.activeServers} aktif`}
            icon={ServerIcon}
          />
          <StatCard
            title="Aktif Sunucu"
            value={loading ? '—' : stats.activeServers}
            subtitle={loading ? 'Yükleniyor…' : `${stats.totalServers - stats.activeServers} sorunlu`}
            icon={CheckCircleIcon}
          />
          <StatCard
            title="Toplam Domain"
            value={loading ? '—' : stats.totalDomains}
            subtitle={loading ? 'Yükleniyor…' : `${stats.activeDomains} aktif`}
            icon={GlobeIcon}
          />
          <StatCard
            title="İzlenen Domain"
            value={loading ? '—' : stats.activeDomains}
            subtitle={loading ? 'Yükleniyor…' : 'Aktif & SSL korumalı'}
            icon={ActivityIcon}
          />
        </div>

        {/* Recent Servers */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sunucular</h2>
            <Link href="/servers/new"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <PlusIcon className="h-3.5 w-3.5" /> Sunucu Ekle
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />)}</div>
          ) : recentServers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz sunucu eklenmedi.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentServers.map(s => (
                <Link key={s.id} href={`/servers/${s.id}`}
                  className="flex items-center justify-between py-3 hover:text-primary transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                      <ServerIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.ip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.domainCount != null && (
                      <span className="text-xs text-muted-foreground">{s.domainCount} domain</span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === 'active' ? 'bg-green-500/10 text-green-400' :
                      s.status === 'error' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>{s.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Hızlı İşlemler</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '/servers/new', label: 'Sunucu Ekle', desc: 'Yeni bir sunucu bağla', icon: ServerIcon },
              { href: '/domains/new', label: 'Domain Ekle', desc: 'Domain oluştur ve yapılandır', icon: GlobeIcon },
              { href: '/monitoring', label: 'İzleme', desc: 'Sunucu metriklerini görüntüle', icon: ActivityIcon },
            ].map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-secondary/50 hover:border-primary/30 transition-all group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
