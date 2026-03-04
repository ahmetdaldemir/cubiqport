// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole = 'admin' | 'user';

// ─── Servers ──────────────────────────────────────────────────────────────────
export type ServerStatus = 'pending' | 'active' | 'error' | 'offline';

export interface Server {
  id: string;
  userId: string;
  name: string;
  ip: string;
  sshPort: number;
  sshUser: string;
  status: ServerStatus;
  agentVersion?: string | null;
  createdAt: Date;
}

// ─── Domains ──────────────────────────────────────────────────────────────────
export type DomainStatus = 'pending' | 'active' | 'error';

export interface Domain {
  id: string;
  serverId: string;
  domain: string;
  rootPath: string;
  port: number;
  sslEnabled: boolean;
  status: DomainStatus;
  createdAt: Date;
}

// ─── DNS ──────────────────────────────────────────────────────────────────────
export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV';

export interface DnsRecord {
  id: string;
  domainId: string;
  cloudflareId?: string | null;
  type: DnsRecordType;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  createdAt: Date;
}

// ─── Deployments ──────────────────────────────────────────────────────────────
export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface Deployment {
  id: string;
  domainId: string;
  repository: string;
  branch: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  status: DeploymentStatus;
  logs?: string | null;
  createdAt: Date;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
export interface NetworkUsage {
  rx: number;
  tx: number;
}

export interface Metric {
  id: string;
  serverId: string;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  networkUsage: NetworkUsage;
  timestamp: Date;
}

export interface LiveMetrics {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  networkUsage: NetworkUsage;
  containers: ContainerInfo[];
  uptime: number;
  timestamp: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string[];
}

// ─── Agent ────────────────────────────────────────────────────────────────────
export interface AgentDeployPayload {
  domainId: string;
  repository: string;
  branch: string;
  buildCommand?: string;
  startCommand?: string;
  rootPath: string;
  port: number;
  envVars?: Record<string, string>;
}

export interface AgentNginxPayload {
  domain: string;
  port: number;
  rootPath: string;
  sslEnabled?: boolean;
}

export interface AgentSslPayload {
  domain: string;
  email: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
