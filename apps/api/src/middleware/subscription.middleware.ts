import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptions } from '../db/schema.js';

/**
 * Middleware: block API access if subscription is expired/canceled
 * Add to routes that require an active subscription.
 * Admin users bypass the check.
 */
export async function requireSubscription(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (req.user?.role === 'admin') return;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, req.user.sub),
  });

  if (!sub) {
    return reply.status(402).send({
      success: false,
      error: 'No active subscription',
      code: 'NO_SUBSCRIPTION',
    });
  }

  const now = new Date();

  if (sub.status === 'trialing' && sub.trialEndsAt < now) {
    // Trial expired
    await db.update(subscriptions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(subscriptions.userId, req.user.sub));
    return reply.status(402).send({
      success: false,
      error: 'Trial period has ended. Please subscribe to continue.',
      code: 'TRIAL_EXPIRED',
    });
  }

  if (sub.status === 'expired' || sub.status === 'canceled') {
    return reply.status(402).send({
      success: false,
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }
}
