'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Server { id: string; name: string; ip: string; status: string; createdAt: string; userEmail: string; }

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminServersPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('cubiq_token');
    if (!token) { router.push('/login'); return; }
    const res  = await fetch(`${API}/api/v1/admin/servers`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setServers(data.data);
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">← Admin Panel</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">Tüm Sunucular ({servers.length})</h1>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Sunucu Adı</th>
              <th className="text-left px-4 py-3 font-medium">IP</th>
              <th className="text-left px-4 py-3 font-medium">Durum</th>
              <th className="text-left px-4 py-3 font-medium">Kullanıcı</th>
              <th className="text-left px-4 py-3 font-medium">Eklenme</th>
            </tr>
          </thead>
          <tbody>
            {servers.map(s => (
              <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.ip}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{s.userEmail}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {servers.length === 0 && <p className="text-center text-muted-foreground py-8">Sunucu bulunamadı.</p>}
      </div>
    </div>
  );
}
