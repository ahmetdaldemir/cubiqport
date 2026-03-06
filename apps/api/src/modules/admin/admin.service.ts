import { desc, eq, count, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import { users, servers, domains, subscriptions, webhookEvents } from '../../db/schema.js';
import { stripe, stripeConfigured } from '../../services/stripe.service.js';
import { sendWelcomeEmail, sendSuspendEmail } from '../../services/email.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';

export class AdminService {

  /** Tüm SaaS kullanıcıları — subscription ve sunucu sayısı ile */
  async listUsers() {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        suspended: users.suspended,
        suspendedAt: users.suspendedAt,
        suspendedReason: users.suspendedReason,
        createdAt: users.createdAt,
        subStatus: subscriptions.status,
        subPeriod: subscriptions.billingPeriod,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .orderBy(desc(users.createdAt));

    // Sunucu sayısını SQL COUNT ile al — tam tablo yükleme yok
    const serverCountRows = await db
      .select({ userId: servers.userId, cnt: count() })
      .from(servers)
      .groupBy(servers.userId);

    const countMap = Object.fromEntries(serverCountRows.map(r => [r.userId, r.cnt]));
    return rows.map(r => ({ ...r, serverCount: countMap[r.id] ?? 0 }));
  }

  /** Belirli kullanıcının sunucuları */
  async getUserServers(userId: string) {
    return db.select().from(servers).where(eq(servers.userId, userId)).orderBy(desc(servers.createdAt));
  }

  /** Belirli kullanıcının domainleri (sunucu adıyla birlikte) */
  async getUserDomains(userId: string) {
    return db
      .select({
        id: domains.id,
        domain: domains.domain,
        rootPath: domains.rootPath,
        status: domains.status,
        sslEnabled: domains.sslEnabled,
        createdAt: domains.createdAt,
        serverId: servers.id,
        serverName: servers.name,
        serverIp: servers.ip,
      })
      .from(domains)
      .innerJoin(servers, eq(servers.id, domains.serverId))
      .where(eq(servers.userId, userId))
      .orderBy(desc(domains.createdAt));
  }

  /** Tüm sunucular (sahibi ile) */
  async listAllServers() {
    return db
      .select({
        id: servers.id,
        name: servers.name,
        ip: servers.ip,
        status: servers.status,
        createdAt: servers.createdAt,
        userId: users.id,
        userEmail: users.email,
      })
      .from(servers)
      .innerJoin(users, eq(users.id, servers.userId))
      .orderBy(desc(servers.createdAt));
  }

  /** Tüm domainler (sahibi ve sunucusu ile) */
  async listAllDomains() {
    return db
      .select({
        id: domains.id,
        domain: domains.domain,
        status: domains.status,
        sslEnabled: domains.sslEnabled,
        createdAt: domains.createdAt,
        serverId: servers.id,
        serverName: servers.name,
        userId: users.id,
        userEmail: users.email,
      })
      .from(domains)
      .innerJoin(servers, eq(servers.id, domains.serverId))
      .innerJoin(users, eq(users.id, servers.userId))
      .orderBy(desc(domains.createdAt));
  }

  /** Stripe webhook olayları (son 500) */
  async listWebhookEvents(limit = 100) {
    return db
      .select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit);
  }

  /** Tek webhook olayı detayı */
  async getWebhookEvent(id: string) {
    return db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.id, id),
    });
  }

  /** Yeni SaaS kullanıcısı oluştur */
  async createUser(email: string, password?: string) {
    // Şifre yoksa rastgele üret
    const rawPassword = password ?? this.generatePassword();
    const hashed = await bcrypt.hash(rawPassword, 10);

    // Mevcut kullanıcı kontrolü
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) throw new ConflictError('Bu e-posta zaten kayıtlı');

    // Stripe müşteri oluştur
    let stripeCustomerId: string | undefined;
    try {
      if (stripeConfigured) {
        const customer = await stripe.customers.create({ email, metadata: { source: 'admin_created' } });
        stripeCustomerId = customer.id;
      }
    } catch (err) {
      logger.warn({ err }, 'Stripe müşteri oluşturulamadı, devam ediliyor');
    }

    // DB'ye kullanıcı ekle
    const [user] = await db.insert(users).values({
      email,
      password: hashed,
      role: 'user',
    }).returning();

    // Trial abonelik oluştur (7 gün)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    await db.insert(subscriptions).values({
      userId: user.id,
      status: 'trialing',
      billingPeriod: 'monthly',
      trialEndsAt: trialEnd,
      stripeCustomerId: stripeCustomerId ?? null,
    });

    // Hoşgeldin maili gönder
    const loginUrl = (config.PUBLIC_URL ?? 'http://localhost:3000') + '/login';
    await sendWelcomeEmail({ to: email, password: rawPassword, loginUrl });

    return { user, rawPassword };
  }

  /** Kullanıcıyı askıya al */
  async suspendUser(userId: string, reason?: string) {
    const [user] = await db.update(users)
      .set({ suspended: true, suspendedAt: new Date(), suspendedReason: reason ?? null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, email: users.email });

    if (!user) throw new NotFoundError('Kullanıcı');

    // Aboneliği de suspend et
    await db.update(subscriptions)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId));

    await sendSuspendEmail(user.email, reason).catch(() => {});
    return user;
  }

  /** Kullanıcı askıya almayı kaldır */
  async unsuspendUser(userId: string) {
    const [user] = await db.update(users)
      .set({ suspended: false, suspendedAt: null, suspendedReason: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, email: users.email });

    if (!user) throw new NotFoundError('Kullanıcı');

    // Aboneliği trialing'e al
    await db.update(subscriptions)
      .set({ status: 'trialing', updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId));

    return user;
  }

  private generatePassword(len = 12): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  /** Özet istatistikler — SQL COUNT agregasyonları ile (tam tablo yükleme yok) */
  async getStats() {
    const [
      [totals],
      [serverCount],
      [domainCount],
      [webhookTotal],
      [webhookErrors],
    ] = await Promise.all([
      // Kullanıcı sayaçları — abonelik durumuna göre
      db
        .select({
          total:    count(),
          active:   sql<number>`COUNT(*) FILTER (WHERE ${subscriptions.status} = 'active')`,
          trialing: sql<number>`COUNT(*) FILTER (WHERE ${subscriptions.status} = 'trialing')`,
        })
        .from(users)
        .leftJoin(subscriptions, eq(subscriptions.userId, users.id)),

      db.select({ cnt: count() }).from(servers),
      db.select({ cnt: count() }).from(domains),
      db.select({ cnt: count() }).from(webhookEvents),
      db.select({ cnt: count() }).from(webhookEvents).where(eq(webhookEvents.processed, false)),
    ]);

    return {
      totalUsers:       Number(totals.total),
      activeUsers:      Number(totals.active),
      trialingUsers:    Number(totals.trialing),
      totalServers:     Number(serverCount.cnt),
      totalDomains:     Number(domainCount.cnt),
      webhookTotal:     Number(webhookTotal.cnt),
      webhookProcessed: Number(webhookTotal.cnt) - Number(webhookErrors.cnt),
      webhookErrors:    Number(webhookErrors.cnt),
    };
  }
}
