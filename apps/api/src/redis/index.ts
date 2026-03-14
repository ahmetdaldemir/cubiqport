/**
 * Redis kaldırıldı — tüm fonksiyonlar no-op.
 * Canlı metrikler agent/SSH fallback ile alınır; analiz işleri API içinde inline çalışır.
 */

export async function connectRedis(): Promise<void> {}
export async function disconnectRedis(): Promise<void> {}

export async function setJson<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {}
export async function getJson<T>(_key: string): Promise<T | null> {
  return null;
}
export function metricsKey(serverId: string) {
  return `metrics:live:${serverId}`;
}
