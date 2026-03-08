import { Redis } from 'ioredis';
import { config, hasRedis } from '../config/index.js';
import { logger } from '../utils/logger.js';

const noOpRedis = {
  connect: async (): Promise<void> => {},
  quit: async (): Promise<void> => {},
  set: async (): Promise<'OK'> => 'OK' as const,
  setex: async (): Promise<'OK'> => 'OK' as const,
  get: async (): Promise<null> => null,
  on: () => noOpRedis,
};

let redisAvailable = false;

function createClient(): Redis {
  if (!hasRedis()) {
    logger.info('REDIS_URL not set — queue and metrics cache disabled');
    return noOpRedis as unknown as Redis;
  }
  const client = new Redis(config.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err: Error) => logger.error({ err }, 'Redis error'));
  client.on('close', () => logger.warn('Redis connection closed'));
  return client;
}

export const redis = createClient();

export async function connectRedis(): Promise<void> {
  if (!hasRedis()) return;
  try {
    await redis.connect();
    await (redis as Redis).ping();
    redisAvailable = true;
  } catch (err) {
    logger.warn({ err }, 'Redis bağlantı/auth hatası — Redis olmadan devam ediliyor (REDIS_URL şifresi kontrol et: redis://:sifre@host:6379)');
    try {
      (redis as Redis).disconnect();
    } catch (_) {}
    redisAvailable = false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (hasRedis() && redisAvailable) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
}

// ─── Typed helpers ────────────────────────────────────────────────────────────
export async function setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  if (!hasRedis() || !redisAvailable) return;
  const serialized = JSON.stringify(value);
  if (ttlSeconds) await redis.setex(key, ttlSeconds, serialized);
  else await redis.set(key, serialized);
}

export async function getJson<T>(key: string): Promise<T | null> {
  if (!hasRedis() || !redisAvailable) return null;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export function metricsKey(serverId: string) {
  return `metrics:live:${serverId}`;
}
