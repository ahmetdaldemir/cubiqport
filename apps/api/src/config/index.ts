import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  /** Redis: kuyruk (BullMQ) ve canlı metrik önbelleği. Yoksa analiz işleri API sürecinde çalışır. */
  REDIS_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().length(64),

  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),

  AGENT_PORT: z.coerce.number().default(9000),
  AGENT_SECRET: z.string().min(16),

  // Email (optional)
  SMTP_HOST:   z.string().optional(),
  SMTP_PORT:   z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER:   z.string().optional(),
  SMTP_PASS:   z.string().optional(),
  SMTP_FROM:   z.string().optional(),

  // Stripe — public key opsiyonel, secret key zorunlu (payment flow etkin ise)
  STRIPE_KEY:            z.string().optional(),
  STRIPE_SECRET:         z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_YEARLY:  z.string().optional(),

  // App
  PUBLIC_URL: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const data = result.data;
  if (data.REDIS_URL === '') data.REDIS_URL = undefined;
  return data;
}

export const config = parseEnv();
export function hasRedis(): boolean {
  return !!config.REDIS_URL?.trim();
}
export type Config = typeof config;
