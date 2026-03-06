'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangleIcon, XIcon } from 'lucide-react';

interface Subscription {
  status: string;
  trialEndsAt: string;
  daysRemaining: number | null;
}

export function TrialBanner() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cubiq_token');
    if (!token) return;

    fetch('/api/v1/billing/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => setSub(j.data))
      .catch(() => {});
  }, []);

  if (!sub || dismissed) return null;

  const days = sub.daysRemaining ?? 0;

  if (sub.status === 'trialing' && days <= 3) {
    return (
      <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-300">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            Deneme süreniz <span className="font-bold">{days === 0 ? 'bugün' : `${days} gün sonra`}</span> bitiyor.{' '}
            <Link href="/billing" className="underline font-semibold hover:text-amber-200">Abone ol →</Link>
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="shrink-0 hover:text-amber-200">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (sub.status === 'expired' || sub.status === 'canceled' || sub.status === 'past_due') {
    return (
      <div className="flex items-center justify-between gap-3 bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 text-xs text-red-300">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            {sub.status === 'past_due' ? 'Ödemeniz başarısız.' : 'Aboneliğiniz sona erdi.'}{' '}
            <Link href="/billing" className="underline font-semibold hover:text-red-200">Yenile →</Link>
          </span>
        </div>
      </div>
    );
  }

  return null;
}
