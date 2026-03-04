import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// ─── Servers ──────────────────────────────────────────────────────────────────
export const CreateServerSchema = z.object({
  name: z.string().min(1).max(100),
  ip: z.string().ip(),
  sshPort: z.number().int().min(1).max(65535).default(22),
  sshUser: z.string().min(1).max(100).default('root'),
  sshKey: z.string().min(1),
});

export const UpdateServerSchema = CreateServerSchema.partial().omit({ sshKey: true });

// ─── Domains ──────────────────────────────────────────────────────────────────
export const CreateDomainSchema = z.object({
  serverId: z.string().uuid(),
  domain: z
    .string()
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/, {
      message: 'Invalid domain format',
    }),
  rootPath: z.string().min(1).default('/var/www'),
  port: z.number().int().min(1).max(65535).default(3000),
});

export const UpdateDomainSchema = CreateDomainSchema.partial();

// ─── DNS ──────────────────────────────────────────────────────────────────────
export const CreateDnsRecordSchema = z.object({
  domainId: z.string().uuid(),
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV']),
  name: z.string().min(1),
  content: z.string().min(1),
  ttl: z.number().int().min(1).default(1),
  proxied: z.boolean().default(false),
});

// ─── Deployments ──────────────────────────────────────────────────────────────
export const CreateDeploymentSchema = z.object({
  domainId: z.string().uuid(),
  repository: z.string().url(),
  branch: z.string().default('main'),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  envVars: z.record(z.string()).optional(),
});

// ─── Agent ────────────────────────────────────────────────────────────────────
export const AgentNginxSchema = z.object({
  domain: z.string(),
  port: z.number().int().positive(),
  rootPath: z.string(),
  sslEnabled: z.boolean().optional(),
});

export const AgentDeploySchema = z.object({
  domainId: z.string(),
  repository: z.string(),
  branch: z.string(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  rootPath: z.string(),
  port: z.number().int().positive(),
  envVars: z.record(z.string()).optional(),
});

export const AgentSslSchema = z.object({
  domain: z.string(),
  email: z.string().email(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateServerInput = z.infer<typeof CreateServerSchema>;
export type UpdateServerInput = z.infer<typeof UpdateServerSchema>;
export type CreateDomainInput = z.infer<typeof CreateDomainSchema>;
export type UpdateDomainInput = z.infer<typeof UpdateDomainSchema>;
export type CreateDnsRecordInput = z.infer<typeof CreateDnsRecordSchema>;
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;
