import autocannon from 'autocannon';
import { logger } from '../../../utils/logger.js';

const DEFAULT_DURATION_SEC = 10;
const DEFAULT_CONCURRENT = 5;

export interface StressTestResult {
  requestsPerSecond: number;
  avgResponseTimeMs: number;
  maxResponseTimeMs: number;
  errorRate: number;
  concurrentUsers: number;
  durationSeconds: number;
  rawData?: Record<string, unknown>;
}

export async function runStressTest(
  domainHost: string,
  options: { durationSeconds?: number; concurrentUsers?: number } = {},
): Promise<StressTestResult> {
  const duration = options.durationSeconds ?? DEFAULT_DURATION_SEC;
  const connections = options.concurrentUsers ?? DEFAULT_CONCURRENT;
  const url = domainHost.startsWith('http') ? domainHost : `https://${domainHost}`;

  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url,
        connections,
        duration,
        timeout: 30,
        method: 'GET',
        headers: { 'user-agent': 'CubiqPort-StressTest/1.0' },
      },
      (err, result) => {
        if (err) {
          logger.warn({ err, domainHost }, 'Stress test error');
          reject(err);
          return;
        }
        const reqTotal = result?.requests?.total ?? 0;
        const reqErrors = result?.errors ?? 0;
        const errorRate = reqTotal > 0 ? (reqErrors / reqTotal) * 100 : 0;
        const lat = result?.latency as { mean?: number; average?: number; max?: number } | undefined;
        resolve({
          requestsPerSecond: result?.requests?.average ?? 0,
          avgResponseTimeMs: lat?.average ?? lat?.mean ?? 0,
          maxResponseTimeMs: result?.latency?.max ?? 0,
          errorRate,
          concurrentUsers: connections,
          durationSeconds: duration,
          rawData: {
            totalRequests: reqTotal,
            totalErrors: reqErrors,
            throughput: result?.throughput,
          },
        });
      },
    );
    autocannon.track(instance, { renderProgressBar: false });
  });
}
