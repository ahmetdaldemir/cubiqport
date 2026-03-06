'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WebhookEvent {
  id: string;
  stripeEventId: string | null;
  eventType: string;
  processed: boolean;
  error: string | null;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function AdminWebhooksPage() {
  const router = useRouter();
  const [events, setEvents]   = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'errors'>('all');

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('cubiq_token');
    if (!token) { router.push('/login'); return; }
    const res  = await fetch(`${API}/api/v1/admin/webhooks?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setEvents(data.data);
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayed = filter === 'errors' ? events.filter(e => !e.processed) : events;

  const typeColor = (type: string) => {
    if (type.startsWith('checkout'))             return 'bg-purple-100 text-purple-700';
    if (type.startsWith('customer.subscription'))return 'bg-blue-100 text-blue-700';
    if (type.startsWith('invoice'))              return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">← Admin Panel</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold">Stripe Webhook Olayları</h1>
        </div>
        <div className="flex gap-2">
          {(['all', 'errors'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {f === 'all' ? `Tümü (${events.length})` : `Hatalar (${events.filter(e => !e.processed).length})`}
            </button>
          ))}
          <button onClick={fetchData} className="px-3 py-1.5 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Yenile</button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Olay Tipi</th>
                <th className="text-left px-4 py-3 font-medium">Stripe Event ID</th>
                <th className="text-left px-4 py-3 font-medium">Durum</th>
                <th className="text-left px-4 py-3 font-medium">Hata</th>
                <th className="text-left px-4 py-3 font-medium">Zaman</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(e => (
                <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor(e.eventType)}`}>{e.eventType}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[180px]">{e.stripeEventId ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.processed
                      ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Başarılı</span>
                      : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Hata</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600 truncate max-w-[200px]">{e.error ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/webhooks/${e.id}`} className="text-xs text-primary hover:underline">Detay</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayed.length === 0 && <p className="text-center text-muted-foreground py-8">Kayıt bulunamadı.</p>}
        </div>
      </div>
    </div>
  );
}
