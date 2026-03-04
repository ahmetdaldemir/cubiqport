import { MonitoringService } from '../modules/monitoring/monitoring.service.js';
import { logger } from '../utils/logger.js';
import { METRICS_INTERVAL_MS } from '@cubiqport/shared';

const monitoringService = new MonitoringService();
let pollerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the background poller that fetches metrics from every active server
 * every METRICS_INTERVAL_MS (10 s by default).
 */
export function startMetricsPoller(): void {
  if (pollerTimer) return;

  pollerTimer = setInterval(async () => {
    try {
      await monitoringService.pollAllServers();
    } catch (err) {
      logger.warn({ err }, 'Metrics poller iteration failed');
    }
  }, METRICS_INTERVAL_MS);

  // Unref so the timer does not prevent the process from exiting naturally
  if (typeof pollerTimer.unref === 'function') pollerTimer.unref();

  logger.info(`Metrics poller started (interval: ${METRICS_INTERVAL_MS}ms)`);
}

export function stopMetricsPoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
    logger.info('Metrics poller stopped');
  }
}
