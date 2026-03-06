import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { subscriptions, billingInfo, invoices, users, webhookEvents } from '../../db/schema.js';
import {
  getPriceId,
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
} from '../../services/stripe.service.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import {
  extractSubscriptionId,
  calcTrialEnd,
  STRIPE_STATUS_MAP,
} from './billing-helpers.js';
import type Stripe from 'stripe';

export type BillingPlan = 'monthly' | 'yearly';

// ─── Service ─────────────────────────────────────────────────────────────────
export class BillingService {

  /** Kullanıcı kaydı sonrası çağrılır — trial başlatır */
  async initUserBilling(userId: string, email: string): Promise<void> {
    try {
      const customerId = await createStripeCustomer(email, userId);
      await db.insert(subscriptions).values({
        userId,
        status: 'trialing',
        billingPeriod: 'monthly',
        trialEndsAt: calcTrialEnd(),
        stripeCustomerId: customerId,
      });
      logger.info({ userId, customerId }, 'Billing initialized for new user');
    } catch (err) {
      // Stripe yapılandırılmamış olabilir — kullanıcıyı yine de oluştur
      try {
        await db.insert(subscriptions).values({
          userId,
          status: 'trialing',
          billingPeriod: 'monthly',
          trialEndsAt: calcTrialEnd(),
        });
        logger.warn({ err, userId }, 'Stripe init failed, trial started without Stripe customer');
      } catch (dbErr) {
        logger.warn({ dbErr, userId }, 'Failed to initialize billing');
      }
    }
  }

  /** Abonelik bilgisi + kalan gün */
  async getSubscription(userId: string) {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    if (!sub) return null;

    const now = new Date();
    let daysRemaining: number | null = null;
    if (sub.status === 'trialing') {
      daysRemaining = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
    }
    return { ...sub, daysRemaining };
  }

  /**
   * Stripe Checkout oturumu oluştur.
   * - Aktif Stripe aboneliği varsa → planı günceller / uzatır (Checkout veya Portal)
   * - Yoksa → yeni abonelik başlatır
   */
  async createCheckout(userId: string, returnBase: string, plan: BillingPlan = 'monthly'): Promise<string> {
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
    if (!sub) throw new NotFoundError('Subscription');
    if (!sub.stripeCustomerId) throw new AppError('Stripe müşteri kaydı bulunamadı. Lütfen destek ile iletişime geçin.', 400);

    const priceId = getPriceId(plan);
    if (!priceId) throw new AppError('Bu plan için fiyat yapılandırılmamış (STRIPE_PRICE_ID_MONTHLY/YEARLY).', 400);

    const url = await createCheckoutSession(
      sub.stripeCustomerId,
      priceId,
      `${returnBase}/billing?success=1`,
      `${returnBase}/billing?canceled=1`,
      // Aktif Stripe aboneliği varsa geçir → plan güncelleme/uzatma yolunu kullan
      sub.stripeSubscriptionId ?? undefined,
    );

    // Seçilen planı kaydet
    await db.update(subscriptions)
      .set({ billingPeriod: plan, updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId));

    return url;
  }

  /** Stripe Müşteri Portalı — mevcut aboneliği yönet */
  async createPortal(userId: string, returnBase: string): Promise<string> {
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
    if (!sub?.stripeCustomerId) throw new AppError('Stripe müşteri kaydı bulunamadı.', 400);
    return createPortalSession(sub.stripeCustomerId, `${returnBase}/billing`);
  }

  /** Fatura bilgisini getir */
  async getBillingInfo(userId: string) {
    return db.query.billingInfo.findFirst({ where: eq(billingInfo.userId, userId) });
  }

  /** Fatura bilgisini kaydet / güncelle */
  async saveBillingInfo(userId: string, data: {
    companyName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    country?: string;
    billingEmail?: string;
  }) {
    const existing = await db.query.billingInfo.findFirst({ where: eq(billingInfo.userId, userId) });
    if (existing) {
      const [updated] = await db.update(billingInfo)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(billingInfo.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(billingInfo).values({ userId, ...data }).returning();
    return created;
  }

  /** Kullanıcının faturalarını listele */
  async listInvoices(userId: string) {
    return db.query.invoices.findMany({
      where: eq(invoices.userId, userId),
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    });
  }

  /** Stripe webhook işle */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = config.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new AppError('Webhook secret yapılandırılmamış', 500);

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(rawBody, signature, secret);
    } catch (err) {
      throw new AppError(`Webhook imza doğrulama başarısız: ${err}`, 400);
    }

    logger.info({ type: event.type }, 'Stripe webhook alındı');

    // Tüm webhook olaylarını DB'ye kaydet
    let webhookRecord: { id: string } | undefined;
    try {
      const [rec] = await db.insert(webhookEvents).values({
        stripeEventId: event.id,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        processed: false,
      }).onConflictDoNothing().returning({ id: webhookEvents.id });
      webhookRecord = rec;
    } catch (err) {
      logger.warn({ err }, 'Webhook event kaydedilemedi (devam ediliyor)');
    }

    let processError: string | undefined;
    try {

    switch (event.type) {

      // ── Checkout tamamlandı (Pricing Table veya herhangi bir Stripe ürünü) ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(stripeSub);
        break;
      }
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;
        await db.update(subscriptions)
          .set({ status: 'canceled', updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        await this.syncInvoice(inv, 'paid');
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        await this.syncInvoice(inv, 'open');
        // Stripe SDK: inv.subscription string | Subscription | null (genişletilmemiş)
        const subId = extractSubscriptionId(inv as unknown);
        if (subId) {
          await db.update(subscriptions)
            .set({ status: 'past_due', updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, subId));
        }
        break;
      }
    }

    } catch (err) {
      processError = err instanceof Error ? err.message : String(err);
      logger.error({ err, eventType: event.type }, 'Webhook işleme hatası');
    }

    // İşlem sonucunu DB'ye yaz
    if (webhookRecord) {
      await db.update(webhookEvents).set({
        processed: !processError,
        error: processError ?? null,
      }).where(eq(webhookEvents.id, webhookRecord.id));
    }

    if (processError) throw new AppError(processError, 500);
  }

  /**
   * Checkout tamamlandığında aboneliği aktif et.
   * Eşleşme sırası:
   *   1. client_reference_id → CubiqPort kullanıcı ID'si
   *   2. Stripe müşteri ID'si → mevcut DB kaydı
   *   3. customer_email → DB'deki e-posta ile kullanıcı bul
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const customerId      = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const clientRefId     = session.client_reference_id; // CubiqPort user ID
    const customerEmail   = session.customer_details?.email ?? session.customer_email;
    const subscriptionId  = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id;

    logger.info({ customerId, clientRefId, customerEmail, subscriptionId }, 'Checkout completed');

    // 1. client_reference_id ile kullanıcı bul (en güvenilir yol)
    let sub = clientRefId
      ? await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, clientRefId) })
      : null;

    // 2. Stripe müşteri ID ile bul
    if (!sub && customerId) {
      sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.stripeCustomerId, customerId) });
    }

    // 3. E-posta ile kullanıcı bul ve subscription oluştur/güncelle
    if (!sub && customerEmail) {
      const user = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
      if (user) {
        sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, user.id) });
        if (!sub) {
          // Yeni subscription kaydı oluştur
          const [created] = await db.insert(subscriptions).values({
            userId: user.id,
            status: 'active',
            billingPeriod: 'monthly',
            trialEndsAt: new Date(),
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          }).returning();
          sub = created;
          logger.info({ userId: user.id }, 'Checkout: yeni subscription kaydı oluşturuldu');
          return;
        }
      }
    }

    if (!sub) {
      logger.warn({ customerId, clientRefId, customerEmail }, 'Checkout: kullanıcı eşleştirilemedi');
      return;
    }


    // Aboneliği aktif et ve Stripe bilgilerini güncelle
    const updateData: Partial<typeof subscriptions.$inferInsert> = {
      status: 'active',
      updatedAt: new Date(),
    };
    if (customerId) updateData.stripeCustomerId = customerId;
    if (subscriptionId) updateData.stripeSubscriptionId = subscriptionId;

    await db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, sub.id));

    logger.info({ userId: sub.userId, subscriptionId }, 'Checkout: abonelik aktif edildi');
  }

  private async syncSubscription(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer : stripeSub.customer.id;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeCustomerId, customerId),
    });
    if (!sub) {
      logger.warn({ customerId }, 'Stripe müşterisi için abonelik bulunamadı');
      return;
    }

    const statusMap = STRIPE_STATUS_MAP;

    // Stripe SDK v17+: current_period_end doğrudan mevcut — eski versiyon uyumu için tip guard
    const subObj = stripeSub as unknown as Record<string, unknown>;
    const periodEnd = typeof subObj.current_period_end === 'number'
      ? subObj.current_period_end
      : undefined;
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

    // Stripe plan tipine göre billing_period belirle
    const priceId = stripeSub.items.data[0]?.price.id;
    const billingPeriod: 'monthly' | 'yearly' = priceId === config.STRIPE_PRICE_ID_YEARLY
      ? 'yearly'
      : 'monthly';

    await db.update(subscriptions).set({
      status: statusMap[stripeSub.status] ?? 'active',
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      billingPeriod,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, sub.id));
  }

  private async syncInvoice(stripeInv: Stripe.Invoice, status: 'paid' | 'open'): Promise<void> {
    const customerId = typeof stripeInv.customer === 'string'
      ? stripeInv.customer : (stripeInv.customer as Stripe.Customer).id;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeCustomerId, customerId),
    });
    if (!sub) return;

    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.stripeInvoiceId, stripeInv.id),
    });

    const billing = await db.query.billingInfo.findFirst({
      where: eq(billingInfo.userId, sub.userId),
    });
    const billingSnapshot = billing ? {
      companyName: billing.companyName ?? '',
      taxId: billing.taxId ?? '',
      address: billing.address ?? '',
      city: billing.city ?? '',
      country: billing.country ?? '',
    } : undefined;

    const invoiceData = {
      stripeInvoiceId: stripeInv.id,
      invoiceNumber: stripeInv.number ?? undefined,
      amountCents: stripeInv.amount_paid || stripeInv.amount_due,
      currency: stripeInv.currency,
      status,
      pdfUrl: stripeInv.invoice_pdf ?? undefined,
      hostedUrl: stripeInv.hosted_invoice_url ?? undefined,
      paidAt: status === 'paid' ? new Date() : undefined,
      periodStart: stripeInv.period_start ? new Date(stripeInv.period_start * 1000) : undefined,
      periodEnd: stripeInv.period_end ? new Date(stripeInv.period_end * 1000) : undefined,
      billingSnapshot,
    };

    if (existing) {
      await db.update(invoices).set(invoiceData).where(eq(invoices.id, existing.id));
    } else {
      await db.insert(invoices).values({ userId: sub.userId, ...invoiceData });
    }
  }
}
