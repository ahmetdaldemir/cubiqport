'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Server { id: string; name: string; ip: string; status: string; createdAt: string; }
interface Domain { id: string; domain: string; status: string; sslEnabled: boolean; serverName: string; serverIp: string; createdAt: string; }

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminUserDetailPage() {
  const { userId }    = useParams<{ userId: string }>();
  const router        = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'servers' | 'domains'>('servers');

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('cubiq_token');
    if (!token) { router.push('/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const [sRes, dRes] = await Promise.all([
      fetch(`${API}/api/v1/admin/users/${userId}/servers`, { headers }),
      fetch(`${API}/api/v1/admin/users/${userId}/domains`, { headers }),
    ]);
    const sData = await sRes.json();
    const dData = await dRes.json();
    if (sData.success) setServers(sData.data);
    if (dData.success) setDomains(dData.data);
    setLoading(false);
  }, [userId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">← Admin Panel</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">Kullanıcı Detayı</h1>
      </div>

      <div className="flex gap-2 border-b">
        {(['servers', 'domains'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'servers' ? `Sunucular (${servers.length})` : `Domainler (${domains.length})`}
          </button>
        ))}
      </div>

      {tab === 'servers' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ad</th>
                <th className="text-left px-4 py-3 font-medium">IP</th>
                <th className="text-left px-4 py-3 font-medium">Durum</th>
                <th className="text-left px-4 py-3 font-medium">Eklenme</th>
              </tr>
            </thead>
            <tbody>
              {servers.map(s => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.ip}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${s.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {servers.length === 0 && <p className="text-center text-muted-foreground py-8">Sunucu bulunamadı.</p>}
        </div>
      )}

      {tab === 'domains' && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Domain</th>
                <th className="text-left px-4 py-3 font-medium">Sunucu</th>
                <th className="text-left px-4 py-3 font-medium">SSL</th>
                <th className="text-left px-4 py-3 font-medium">Durum</th>
                <th className="text-left px-4 py-3 font-medium">Eklenme</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <tr key={d.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{d.domain}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{d.serverName} ({d.serverIp})</td>
                  <td className="px-4 py-3">{d.sslEnabled ? '✓' : '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(d.createdAt).toLocaleDateString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {domains.length === 0 && <p className="text-center text-muted-foreground py-8">Domain bulunamadı.</p>}
        </div>
      )}
    </div>
  );
}
