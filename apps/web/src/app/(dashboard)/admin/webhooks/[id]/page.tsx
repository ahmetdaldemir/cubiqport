'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface WebhookEvent {
  id: string;
  stripeEventId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  processed: boolean;
  error: string | null;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function WebhookEventDetailPage() {
  const { id }            = useParams<{ id: string }>();
  const router            = useRouter();
  const [event, setEvent] = useState<WebhookEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('cubiq_token');
    if (!token) { router.push('/login'); return; }
    const res  = await fetch(`${API}/api/v1/admin/webhooks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setEvent(data.data);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!event) return <div className="p-6 text-muted-foreground">Event bulunamadı.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/webhooks" className="text-muted-foreground hover:text-foreground text-sm">← Webhook Olayları</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">Olay Detayı</h1>
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-muted-foreground text-xs">Olay Tipi</p><p className="font-medium mt-0.5">{event.eventType}</p></div>
          <div><p className="text-muted-foreground text-xs">Durum</p>
            <p className={`font-medium mt-0.5 ${event.processed ? 'text-green-600' : 'text-red-600'}`}>
              {event.processed ? 'Başarılı' : 'Hata'}
            </p>
          </div>
          <div><p className="text-muted-foreground text-xs">Stripe Event ID</p><p className="font-mono text-xs mt-0.5">{event.stripeEventId ?? '—'}</p></div>
          <div><p className="text-muted-foreground text-xs">Zaman</p><p className="text-xs mt-0.5">{new Date(event.createdAt).toLocaleString('tr-TR')}</p></div>
          {event.error && <div className="col-span-2"><p className="text-muted-foreground text-xs">Hata Mesajı</p><p className="text-red-600 text-xs mt-0.5">{event.error}</p></div>}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Ham Payload</h2>
        </div>
        <pre className="p-5 text-xs overflow-auto max-h-[60vh] bg-muted/30 text-muted-foreground">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}
