import { config } from '../config/index.js';
import { AgentError } from '../utils/errors.js';
import type {
  AgentNginxPayload,
  AgentDeployPayload,
  AgentSslPayload,
  LiveMetrics,
} from '@cubiqport/shared';

const AGENT_TIMEOUT_MS = 60_000;

function agentUrl(ip: string, path: string): string {
  return `http://${ip}:${config.AGENT_PORT}${path}`;
}

async function agentFetch<T>(
  ip: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const response = await fetch(agentUrl(ip, path), {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Secret': config.AGENT_SECRET,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AgentError(`${path} → HTTP ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof AgentError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AgentError(`Request to agent timed out (${AGENT_TIMEOUT_MS}ms)`);
    }
    throw new AgentError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

export class AgentService {
  async getMetrics(ip: string): Promise<LiveMetrics> {
    return agentFetch<LiveMetrics>(ip, '/metrics');
  }

  async createNginxConfig(ip: string, payload: AgentNginxPayload): Promise<{ path: string }> {
    return agentFetch(ip, '/nginx/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async removeNginxConfig(ip: string, domain: string): Promise<{ success: boolean }> {
    return agentFetch(ip, '/nginx/remove', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  }

  async installSsl(ip: string, payload: AgentSslPayload): Promise<{ success: boolean }> {
    return agentFetch(ip, '/ssl/install', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deploy(ip: string, payload: AgentDeployPayload): Promise<{ jobId: string }> {
    return agentFetch(ip, '/deploy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async ping(ip: string): Promise<boolean> {
    try {
      await agentFetch(ip, '/health');
      return true;
    } catch {
      return false;
    }
  }
}
