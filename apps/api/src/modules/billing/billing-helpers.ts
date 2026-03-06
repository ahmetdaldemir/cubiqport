/** Deneme süresi gün sayısı — tek kaynak */
export const TRIAL_DAYS = 7;

/**
 * Stripe Invoice.subscription alanı string | Stripe.Subscription | null olabilir.
 * SDK tip sistemi her zaman expand edilmiş obje döndürebilir.
 * Bu fonksiyon her iki durumda da güvenli şekilde ID döndürür.
 */
export function extractSubscriptionId(inv: unknown): string | null {
  if (!inv || typeof inv !== 'object') return null;
  const sub = (inv as Record<string, unknown>).subscription;
  if (!sub) return null;
  if (typeof sub === 'string') return sub;
  if (typeof sub === 'object' && 'id' in sub) return (sub as { id: string }).id;
  return null;
}

/** Deneme süresinin biteceği tarihi hesapla */
export function calcTrialEnd(fromDate = new Date()): Date {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

/** Abonelik durumunu Stripe status → internal status'a map et */
export const STRIPE_STATUS_MAP: Record<string, 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'> = {
  trialing:           'trialing',
  active:             'active',
  past_due:           'past_due',
  canceled:           'canceled',
  unpaid:             'past_due',
  incomplete:         'past_due',
  incomplete_expired: 'expired',
  paused:             'past_due',
};
