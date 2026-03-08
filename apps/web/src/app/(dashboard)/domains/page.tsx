'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  PlusIcon,
  GlobeIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  ServerIcon,
  ChevronRightIcon,
  SearchIcon,
  ZapIcon,
  ShieldAlertIcon,
  Loader2,
  XIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import type { Domain, SeoReport, StressTestReport, SecurityScanReport } from '@cubiqport/shared';

function useToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cubiq_token') ?? '' : '';
}

interface ServerInfo {
  id: string;
  name: string;
  ip: string;
  status: string;
}

interface ServerGroup {
  server: ServerInfo;
  domains: Domain[];
}

type AnalysisType = 'seo' | 'stress' | 'security';

// ─── Result modal (SEO / Stress / Security) ───────────────────────────────────
function AnalysisResultModal({
  type,
  domainName,
  report,
  onClose,
}: {
  type: AnalysisType;
  domainName: string;
  report: SeoReport | StressTestReport | SecurityScanReport;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold">
            {type === 'seo' && 'SEO Analizi'}
            {type === 'stress' && 'Stres Testi'}
            {type === 'security' && 'Güvenlik Taraması'} — {domainName}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 overflow-auto space-y-4">
          {type === 'seo' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{(report as SeoReport).seoScore}</span>
                <span className="text-sm text-muted-foreground">SEO Skoru</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <p><span className="text-muted-foreground">Başlık:</span> {(report as SeoReport).title ?? '—'}</p>
                <p><span className="text-muted-foreground">Meta açıklama:</span> {(report as SeoReport).metaDescription ?? '—'}</p>
                <p><span className="text-muted-foreground">Yükleme süresi:</span> {(report as SeoReport).loadTimeMs} ms</p>
                <p><span className="text-muted-foreground">Mobil uyumlu:</span> {(report as SeoReport).mobileFriendly ? 'Evet' : 'Hayır'}</p>
                <p><span className="text-muted-foreground">H1 sayısı:</span> {(report as SeoReport).h1Tags?.length ?? 0}</p>
                <p><span className="text-muted-foreground">Kırık link:</span> {(report as SeoReport).brokenLinksCount}</p>
                <p><span className="text-muted-foreground">Sitemap:</span> {(report as SeoReport).sitemapExists ? 'Var' : 'Yok'}</p>
                <p><span className="text-muted-foreground">Robots.txt:</span> {(report as SeoReport).robotsTxtExists ? 'Var' : 'Yok'}</p>
              </div>
            </>
          )}
          {type === 'stress' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{(report as StressTestReport).requestsPerSecond?.toFixed(1) ?? 0}</span>
                <span className="text-sm text-muted-foreground">req/s</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <p><span className="text-muted-foreground">Ort. yanıt süresi:</span> {(report as StressTestReport).avgResponseTimeMs?.toFixed(0) ?? 0} ms</p>
                <p><span className="text-muted-foreground">Maks. yanıt süresi:</span> {(report as StressTestReport).maxResponseTimeMs?.toFixed(0) ?? 0} ms</p>
                <p><span className="text-muted-foreground">Hata oranı:</span> {(report as StressTestReport).errorRate?.toFixed(2) ?? 0}%</p>
                <p><span className="text-muted-foreground">Eşzamanlı kullanıcı:</span> {(report as StressTestReport).concurrentUsers ?? 0}</p>
                <p><span className="text-muted-foreground">Süre:</span> {(report as StressTestReport).durationSeconds ?? 0} sn</p>
              </div>
            </>
          )}
          {type === 'security' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{(report as SecurityScanReport).securityScore}</span>
                <span className="text-sm text-muted-foreground">Güvenlik Skoru</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <p><span className="text-muted-foreground">HTTPS:</span> {(report as SecurityScanReport).httpsEnabled ? 'Aktif' : 'Hayır'}</p>
                <p><span className="text-muted-foreground">SSL geçerli:</span> {(report as SecurityScanReport).sslValid ? 'Evet' : 'Hayır'}</p>
                <p><span className="text-muted-foreground">Dizin listeleme:</span> {(report as SecurityScanReport).directoryListingEnabled ? 'Açık' : 'Kapalı'}</p>
                {(report as SecurityScanReport).vulnerabilities?.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1">Tespitler:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      {(report as SecurityScanReport).vulnerabilities.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            {formatDate(String((report as { createdAt: string | Date }).createdAt))}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DomainsPage() {
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalDomains, setTotalDomains] = useState(0);
  const token = useToken();
  const [analysisLoading, setAnalysisLoading] = useState<{ domainId: string; type: AnalysisType } | null>(null);
  const [resultModal, setResultModal] = useState<{
    type: AnalysisType;
    domainName: string;
    report: SeoReport | StressTestReport | SecurityScanReport;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [serversRes, domainsRes] = await Promise.all([
        fetch('/api/v1/servers', { headers }),
        fetch('/api/v1/domains', { headers }),
      ]);
      const serversJson = await serversRes.json();
      const domainsJson = await domainsRes.json();
      if (!serversRes.ok) throw new Error(serversJson.error ?? 'Sunucular yüklenemedi');
      if (!domainsRes.ok) throw new Error(domainsJson.error ?? 'Domainler yüklenemedi');

      const serverList: ServerInfo[] = serversJson.data ?? [];
      const domainList: Domain[] = domainsJson.data ?? [];
      setTotalDomains(domainList.length);

      // Group domains by server
      const grouped: ServerGroup[] = serverList.map(server => ({
        server,
        domains: domainList.filter(d => d.serverId === server.id),
      })).filter(g => g.domains.length > 0);

      // Ungrouped domains (no matching server)
      const groupedIds = new Set(grouped.flatMap(g => g.domains.map(d => d.id)));
      const ungrouped = domainList.filter(d => !groupedIds.has(d.id));
      if (ungrouped.length > 0) {
        grouped.push({
          server: { id: '', name: 'Bilinmeyen Sunucu', ip: '', status: 'error' },
          domains: ungrouped,
        });
      }

      setGroups(grouped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startAnalysis = useCallback(
    async (domainId: string, domainName: string, type: AnalysisType) => {
      const headers = { Authorization: `Bearer ${token}` };
      setAnalysisLoading({ domainId, type });
      try {
        const path =
          type === 'seo' ? 'seo' : type === 'stress' ? 'stress' : 'security';
        const res = await fetch(`/api/v1/domains/${domainId}/analysis/${path}`, {
          method: 'POST',
          headers,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Analiz başlatılamadı');
          return;
        }
        const prevList: unknown[] = [];
        const maxWait = 90;
        const interval = 2;
        for (let elapsed = 0; elapsed < maxWait; elapsed += interval) {
          await new Promise((r) => setTimeout(r, interval * 1000));
          const listRes = await fetch(
            `/api/v1/domains/${domainId}/analysis/${path}`,
            { headers },
          );
          const listJson = await listRes.json();
          const list = (listJson.data ?? []) as { id: string; createdAt: string }[];
          if (list.length > 0) {
            const latest = list[0];
            const reportRes = await fetch(
              `/api/v1/domains/${domainId}/analysis/${path}/${latest.id}`,
              { headers },
            );
            const reportJson = await reportRes.json();
            if (reportRes.ok && reportJson.data) {
              setResultModal({
                type,
                domainName,
                report: reportJson.data,
              });
            }
            break;
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Analiz hatası');
      } finally {
        setAnalysisLoading(null);
      }
    },
    [token],
  );

  return (
    <div className="flex flex-col">
      <Header title="Domainler" description="Nginx konfigürasyonlarını ve SSL sertifikalarını yönetin" />

      <div className="p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Yükleniyor…' : `${totalDomains} domain · ${groups.length} sunucu`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-secondary/80"
            >
              <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/domains/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Domain Ekle
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="h-5 w-40 rounded bg-secondary animate-pulse" />
                <div className="h-12 rounded-lg bg-secondary animate-pulse" />
                <div className="h-12 rounded-lg bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <GlobeIcon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Henüz domain yok</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Domain ekleyin — DNS, Nginx ve SSL otomatik yapılandırılır.
            </p>
            <Link
              href="/domains/new"
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Domain Ekle
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(({ server, domains }) => (
              <div key={server.id || 'ungrouped'} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Server header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-secondary/30">
                  <div className="flex items-center gap-2.5">
                    <ServerIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-semibold">{server.name}</span>
                      {server.ip && (
                        <span className="ml-2 text-xs text-muted-foreground">{server.ip}</span>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      server.status === 'active' ? 'bg-green-500/10 text-green-400' :
                      server.status === 'error' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>{server.status}</span>
                    <span className="text-xs text-muted-foreground">{domains.length} domain</span>
                  </div>
                  {server.id && (
                    <Link
                      href={`/servers/${server.id}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Sunucuya git <ChevronRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>

                {/* Domains table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Domain</th>
                      <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Durum</th>
                      <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SSL</th>
                      <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Port</th>
                      <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Eklenme</th>
                      <th className="px-5 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {domains.map((d) => {
                      const isSeo = analysisLoading?.domainId === d.id && analysisLoading?.type === 'seo';
                      const isStress = analysisLoading?.domainId === d.id && analysisLoading?.type === 'stress';
                      const isSecurity = analysisLoading?.domainId === d.id && analysisLoading?.type === 'security';
                      return (
                        <tr key={d.id} className="transition hover:bg-secondary/30">
                          <td className="px-5 py-3.5 font-medium">
                            <Link
                              href={`/domains/${d.id}`}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              <GlobeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {d.domain}
                            </Link>
                          </td>
                          <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                          <td className="px-5 py-3.5">
                            {d.sslEnabled ? (
                              <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                                <ShieldCheckIcon className="h-3.5 w-3.5" /> Aktif
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground text-xs">:{d.port}</td>
                          <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(d.createdAt)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => startAnalysis(d.id, d.domain, 'seo')}
                                disabled={!!analysisLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50 transition"
                                title="SEO Analizi"
                              >
                                {isSeo ? <Loader2 className="h-3 w-3 animate-spin" /> : <SearchIcon className="h-3 w-3" />}
                                SEO
                              </button>
                              <button
                                onClick={() => startAnalysis(d.id, d.domain, 'stress')}
                                disabled={!!analysisLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50 transition"
                                title="Stres Testi"
                              >
                                {isStress ? <Loader2 className="h-3 w-3 animate-spin" /> : <ZapIcon className="h-3 w-3" />}
                                Stres
                              </button>
                              <button
                                onClick={() => startAnalysis(d.id, d.domain, 'security')}
                                disabled={!!analysisLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50 transition"
                                title="Güvenlik Taraması"
                              >
                                {isSecurity ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlertIcon className="h-3 w-3" />}
                                Güvenlik
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {resultModal && (
        <AnalysisResultModal
          type={resultModal.type}
          domainName={resultModal.domainName}
          report={resultModal.report}
          onClose={() => setResultModal(null)}
        />
      )}
    </div>
  );
}
