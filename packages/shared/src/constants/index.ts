export const AGENT_PORT = 9000;
export const API_PORT = 4000;

export const METRICS_TTL_SECONDS = 300; // 5 min in Redis
export const METRICS_INTERVAL_MS = 10_000; // 10 s

export const SERVER_STATUSES = ['pending', 'active', 'error', 'offline'] as const;
export const DOMAIN_STATUSES = ['pending', 'active', 'error'] as const;
export const DEPLOYMENT_STATUSES = ['pending', 'running', 'success', 'failed', 'cancelled'] as const;

export const DEFAULT_SSH_PORT = 22;
export const DEFAULT_APP_PORT = 3000;
export const DEFAULT_ROOT_PATH = '/var/www';
