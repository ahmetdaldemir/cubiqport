import { eq, gte, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { metrics, servers } from '../../db/schema.js';
import { setJson, getJson, metricsKey } from '../../redis/index.js';
import { ServerRepository } from '../servers/server.repository.js';
import { AgentService } from '../../services/agent.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { METRICS_TTL_SECONDS } from '@cubiqport/shared';
import type { LiveMetrics } from '@cubiqport/shared';

const serverRepo = new ServerRepository();
const agentService = new AgentService();

export class MonitoringService {
  /**
   * Fetch live metrics from Redis cache; falls back to polling the agent.
   */
  async getLiveMetrics(serverId: string, userId: string): Promise<LiveMetrics> {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');

    const cached = await getJson<LiveMetrics>(metricsKey(serverId));
    if (cached) return cached;

    // Cache miss — poll agent directly
    const live = await agentService.getMetrics(server.ip);
    await setJson(metricsKey(serverId), live, METRICS_TTL_SECONDS);
    return live;
  }

  /**
   * Store a metrics snapshot pushed by the agent.
   * Called by the agent webhook or an internal poller.
   */
  async storeMetrics(serverId: string, data: LiveMetrics): Promise<void> {
    // Write to Redis for real-time dashboard
    await setJson(metricsKey(serverId), data, METRICS_TTL_SECONDS);

    // Persist to Postgres (sampled — store every call; caller controls frequency)
    await db.insert(metrics).values({
      serverId,
      cpuUsage: data.cpuUsage,
      ramUsage: data.ramUsage,
      diskUsage: data.diskUsage,
      networkUsage: data.networkUsage,
      timestamp: new Date(data.timestamp),
    });
  }

  /**
   * Historical metrics for a server (last N hours).
   */
  async getHistoricalMetrics(serverId: string, userId: string, hours = 24) {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db.query.metrics.findMany({
      where: and(eq(metrics.serverId, serverId), gte(metrics.timestamp, since)),
      orderBy: (m, { asc }) => [asc(m.timestamp)],
      // Limit to 1440 points max (1 per minute for 24h)
      limit: 1440,
    });
  }

  /**
   * Poller: fetch metrics from all active servers and persist them.
   * Intended to be called on a cron-like interval.
   */
  async pollAllServers(): Promise<void> {
    const activeServers = await db.query.servers.findMany({
      where: eq(servers.status, 'active'),
      columns: { id: true, ip: true },
    });

    await Promise.allSettled(
      activeServers.map(async (server) => {
        try {
          const live = await agentService.getMetrics(server.ip);
          await this.storeMetrics(server.id, live);
        } catch (err) {
          logger.warn({ err, serverId: server.id }, 'Failed to poll metrics');
        }
      }),
    );
  }
}
