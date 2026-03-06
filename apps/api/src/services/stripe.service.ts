import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';
export const stripeConfigured = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');

export const stripe: Stripe = stripeConfigured
  ? new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' as never })
  : (null as unknown as Stripe);

export const TRIAL_DAYS = 7;

// Aylık ve yıllık Stripe Price ID'leri
// Yıllık yoksa aylık ID'yi fallback olarak kullan
export const PRICE_ID_MONTHLY =
  process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID ?? '';
export const PRICE_ID_YEARLY =
  process.env.STRIPE_PRICE_ID_YEARLY ?? PRICE_ID_MONTHLY;

/** Stripe yapılandırılmamışsa hata fırlat */
function requireStripe(): void {
  if (!stripeConfigured) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
}

/** Plan tipine göre Price ID döndür */
export function getPriceId(plan: 'monthly' | 'yearly'): string {
  return plan === 'yearly' ? PRICE_ID_YEARLY : PRICE_ID_MONTHLY;
}

/** Yeni Stripe müşterisi oluştur */
export async function createStripeCustomer(email: string, userId: string): Promise<string> {
  requireStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });
  return customer.id;
}

/** Deneme süreli Stripe aboneliği başlat */
export async function createTrialSubscription(
  stripeCustomerId: string,
  priceId: string,
  trialDays: number,
): Promise<Stripe.Subscription> {
  requireStripe();
  return stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });
}

/**
 * Stripe Checkout oturumu oluştur.
 * - Aktif Stripe aboneliği varsa mevcut aboneliği günceller (upgrade/extend).
 * - Yoksa yeni abonelik başlatır.
 */
export async function createCheckoutSession(
  stripeCustomerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  existingSubscriptionId?: string | null,
): Promise<string> {
  requireStripe();

  // Zaten aktif Stripe aboneliği varsa → fiyat değiştirilir / uzatılır
  if (existingSubscriptionId) {
    const stripeSub = await stripe.subscriptions.retrieve(existingSubscriptionId);
    const currentItemId = stripeSub.items.data[0]?.id;

    if (currentItemId) {
      // Aynı plan → dönem sonuna kadar ücret alınmaz, otomatik yenilenir
      // Farklı plan → prorated değişim
      await stripe.subscriptions.update(existingSubscriptionId, {
        items: [{ id: currentItemId, price: priceId }],
        proration_behavior: 'create_prorations',
      });
      // Değişim URL'i: doğrudan portala yönlendir
      const portal = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: successUrl,
      });
      return portal.url;
    }
  }

  // Yeni abonelik checkout'u
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_collection: 'always',
    subscription_data: { metadata: { source: 'cubiqport' } },
  });
  return session.url!;
}

/** Stripe Müşteri Portalı oturumu oluştur */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string> {
  requireStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

/** Dönem sonunda iptal et */
export async function cancelSubscription(stripeSubscriptionId: string): Promise<void> {
  requireStripe();
  await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
}

/** Webhook imzasını doğrula ve event oluştur */
export function constructWebhookEvent(
  payload: Buffer | string,
  signature: string,
  secret: string,
): Stripe.Event {
  requireStripe();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
