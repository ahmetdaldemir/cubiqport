import { FastifyInstance } from 'fastify';
import {
  getSubscription,
  createCheckout,
  createPortal,
  getBillingInfo,
  saveBillingInfo,
  listInvoices,
  stripeWebhook,
} from './billing.controller.js';

export async function billingRoutes(fastify: FastifyInstance) {
  // Stripe webhook imza doğrulaması için raw body gerekli.
  // Sadece bu plugin scope'una uygula — Fastify'ın global AJV integrasyon'unu bozma.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (_req, body, done) {
    try {
      const parsed = JSON.parse((body as Buffer).toString());
      // rawBody'yi request objesine ekle — imza doğrulama için
      done(null, { ...parsed, _rawBody: body });
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const auth = { preHandler: [fastify.authenticate] };

  const checkoutBodySchema = {
    type: 'object',
    required: ['plan'],
    properties: {
      plan: { type: 'string', enum: ['monthly', 'yearly'] },
    },
    additionalProperties: false,
  } as const;

  fastify.get('/subscription', auth, getSubscription);
  fastify.post('/checkout', { ...auth, schema: { body: checkoutBodySchema } }, createCheckout);
  fastify.get('/portal', auth, createPortal);
  fastify.post('/portal', auth, createPortal);
  fastify.get('/info', auth, getBillingInfo);
  fastify.post('/info', auth, saveBillingInfo);
  fastify.get('/invoices', auth, listInvoices);

  // Stripe webhook — auth yok, raw body yukarıda yakalanıyor
  fastify.post('/webhook', stripeWebhook);
}
