'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { ProgressRing } from '@/components/ui/progress-ring';
import { formatUptime, formatBytes } from '@/lib/utils';
import { Cpu, MemoryStick, HardDrive, WifiIcon, RefreshCwIcon, ContainerIcon, ServerIcon } from 'lucide-react';
import type { LiveMetrics } from '@cubiqport/shared';
import type { Server } from '@cubiqport/shared';

const POLL_INTERVAL = 10_000;

export default function MonitoringPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [serverId, setServerId] = useState<string>('');
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';

  useEffect(() => {
    fetch('/api/v1/servers', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        const list = j.data ?? [];
        setServers(list);
        if (list.length && !serverId) setServerId(list[0].id);
      })
      .catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMetrics = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/monitoring/servers/${serverId}/live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMetrics(json.data as LiveMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [serverId, token]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="flex flex-col">
      <Header title="Monitoring" description="Real-time server metrics — refreshes every 10 s" />

      <div className="p-6 space-y-6">
        {/* Server selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-[200px]">
            <ServerIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Sunucu seçin…</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.ip}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchMetrics}
            disabled={loading || !serverId}
            className="flex items-center gap-2 rounded-lg bg-secondary border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary/80 disabled:opacity-50"
          >
            <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
          {servers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Kayıtlı sunucu yok.{' '}
              <Link href="/servers/new" className="text-primary hover:underline">
                Sunucu ekle
              </Link>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!metrics ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <Cpu className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {serverId ? 'Metrikler yükleniyor…' : 'Görüntülemek için yukarıdan bir sunucu seçin'}
            </p>
          </div>
        ) : (
          <>
            {/* Metric rings */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'CPU', value: metrics.cpuUsage, icon: Cpu },
                { label: 'RAM', value: metrics.ramUsage, icon: MemoryStick },
                { label: 'Disk', value: metrics.diskUsage, icon: HardDrive },
                { label: 'Net RX', value: 0, icon: WifiIcon, raw: formatBytes(metrics.networkUsage.rx) },
              ].map(({ label, value, icon: Icon, raw }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  {raw ? (
                    <div className="text-center">
                      <p className="text-2xl font-bold">{raw}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ) : (
                    <ProgressRing value={value} size={90} label={label} />
                  )}
                </div>
              ))}
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Uptime</p>
                <p className="text-sm font-semibold">{formatUptime(metrics.uptime)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Containers</p>
                <p className="text-sm font-semibold">{metrics.containers.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Net TX</p>
                <p className="text-sm font-semibold">{formatBytes(metrics.networkUsage.tx)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Last updated</p>
                <p className="text-sm font-semibold">
                  {new Date(metrics.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Containers */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Running Containers ({metrics.containers.length})
              </h3>
              {metrics.containers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <ContainerIcon className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No containers running</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.image}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{c.id}</p>
                        <p className="text-xs text-green-400">{c.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
