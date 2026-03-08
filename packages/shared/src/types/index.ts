// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole = 'superadmin' | 'admin' | 'user';

// ─── Servers ──────────────────────────────────────────────────────────────────
export type ServerStatus = 'pending' | 'active' | 'error' | 'offline';

export interface ScanData {
  os?: string;
  uptime?: string;
  ramTotal?: string;
  ramUsed?: string;
  diskUsedPct?: string;
  technologies?: { name: string; version: string; status: string }[];
  databases?: string[];
  nginxDomains?: string[];
  nginxDomainDetails?: { domain: string; rootPath: string }[];
  containers?: { name: string; image: string; status: string }[];
}

export interface Server {
  id: string;
  userId: string;
  name: string;
  ip: string;
  sshPort: number;
  sshUser: string;
  sshAuthType: string;
  status: ServerStatus;
  agentVersion?: string | null;
  scanData?: ScanData | null;
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

// ─── Agent Payloads ───────────────────────────────────────────────────────────
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

// ─── Technologies ─────────────────────────────────────────────────────────────
export type ServiceStatus = 'running' | 'stopped' | 'unknown';

export interface TechVersion {
  label: string;
  value: string;
}

export interface TechStatus {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  installed: boolean;
  version?: string;
  serviceStatus?: ServiceStatus;
  versions?: TechVersion[];
  defaultVersion?: string;
}

// ─── Domain Analysis (SEO, Stress, Security) ───────────────────────────────────
export interface SeoReport {
  id: string;
  domainId: string;
  title: string | null;
  metaDescription: string | null;
  h1Tags: string[];
  loadTimeMs: number;
  mobileFriendly: boolean;
  lighthouseScore: number | null;
  brokenLinksCount: number;
  sitemapExists: boolean;
  robotsTxtExists: boolean;
  seoScore: number;
  rawData?: Record<string, unknown>;
  createdAt: Date;
}

export interface StressTestReport {
  id: string;
  domainId: string;
  requestsPerSecond: number;
  avgResponseTimeMs: number;
  maxResponseTimeMs: number;
  errorRate: number;
  concurrentUsers: number;
  durationSeconds: number;
  rawData?: Record<string, unknown>;
  createdAt: Date;
}

export interface SecurityScanReport {
  id: string;
  domainId: string;
  securityScore: number;
  httpsEnabled: boolean;
  securityHeaders: Record<string, string>;
  openPorts: number[];
  vulnerabilities: string[];
  sslValid: boolean;
  directoryListingEnabled: boolean;
  rawData?: Record<string, unknown>;
  createdAt: Date;
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
