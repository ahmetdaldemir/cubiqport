import { FastifyRequest, FastifyReply } from 'fastify';
import { BillingService, BillingPlan } from './billing.service.js';

const service = new BillingService();

const RETURN_BASE = process.env.PUBLIC_URL ?? 'http://localhost:3000';

export async function getSubscription(req: FastifyRequest, reply: FastifyReply) {
  const sub = await service.getSubscription(req.user.sub);
  return reply.send({ success: true, data: sub });
}

export async function createCheckout(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as { plan?: BillingPlan } | undefined;
  const plan: BillingPlan = body?.plan === 'yearly' ? 'yearly' : 'monthly';
  const url = await service.createCheckout(req.user.sub, RETURN_BASE, plan);
  return reply.send({ success: true, data: { url } });
}

export async function createPortal(req: FastifyRequest, reply: FastifyReply) {
  const url = await service.createPortal(req.user.sub, RETURN_BASE);
  return reply.send({ success: true, data: { url } });
}

export async function getBillingInfo(req: FastifyRequest, reply: FastifyReply) {
  const info = await service.getBillingInfo(req.user.sub);
  return reply.send({ success: true, data: info });
}

export async function saveBillingInfo(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as {
    companyName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    country?: string;
    billingEmail?: string;
  };
  const info = await service.saveBillingInfo(req.user.sub, body);
  return reply.send({ success: true, data: info });
}

export async function listInvoices(req: FastifyRequest, reply: FastifyReply) {
  const items = await service.listInvoices(req.user.sub);
  return reply.send({ success: true, data: items });
}

export async function stripeWebhook(req: FastifyRequest, reply: FastifyReply) {
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) return reply.status(400).send({ error: 'Missing stripe-signature' });

  // rawBody, billing.routes.ts'deki scoped content-type parser tarafından ekleniyor
  const rawBody = (req.body as Record<string, unknown>)?._rawBody as Buffer | undefined;
  if (!rawBody) return reply.status(400).send({ error: 'Missing raw body' });

  await service.handleWebhook(rawBody, sig);
  return reply.send({ received: true });
}
