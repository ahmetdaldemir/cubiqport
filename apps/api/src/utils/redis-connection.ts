/**
 * BullMQ için Redis bağlantı seçenekleri.
 * REDIS_URL örnek: redis://localhost:6379 veya redis://:password@host:6379
 */
export function getBullMQConnectionOptions(redisUrl: string): {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: number;
} {
  const url = new URL(redisUrl);
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    ...(password && { password }),
    maxRetriesPerRequest: 3,
  };
}
