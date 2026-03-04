import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const serverStatusEnum = pgEnum('server_status', ['pending', 'active', 'error', 'offline']);
export const domainStatusEnum = pgEnum('domain_status', ['pending', 'active', 'error']);
export const deploymentStatusEnum = pgEnum('deployment_status', [
  'pending',
  'running',
  'success',
  'failed',
  'cancelled',
]);
export const dnsTypeEnum = pgEnum('dns_type', ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV']);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Servers ──────────────────────────────────────────────────────────────────
export const servers = pgTable(
  'servers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    ip: varchar('ip', { length: 45 }).notNull(),
    sshPort: integer('ssh_port').notNull().default(22),
    sshUser: varchar('ssh_user', { length: 100 }).notNull().default('root'),
    // Encrypted PEM key stored at rest
    sshKey: text('ssh_key').notNull(),
    status: serverStatusEnum('status').notNull().default('pending'),
    agentVersion: varchar('agent_version', { length: 50 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('servers_user_id_idx').on(t.userId)],
);

// ─── Domains ──────────────────────────────────────────────────────────────────
export const domains = pgTable(
  'domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 255 }).notNull().unique(),
    rootPath: varchar('root_path', { length: 500 }).notNull().default('/var/www'),
    port: integer('port').notNull().default(3000),
    sslEnabled: boolean('ssl_enabled').notNull().default(false),
    sslEmail: varchar('ssl_email', { length: 255 }),
    status: domainStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('domains_server_id_idx').on(t.serverId)],
);

// ─── DNS Records ──────────────────────────────────────────────────────────────
export const dnsRecords = pgTable(
  'dns_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    cloudflareId: varchar('cloudflare_id', { length: 255 }),
    type: dnsTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    content: varchar('content', { length: 255 }).notNull(),
    ttl: integer('ttl').notNull().default(1),
    proxied: boolean('proxied').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('dns_domain_id_idx').on(t.domainId)],
);

// ─── Deployments ──────────────────────────────────────────────────────────────
export const deployments = pgTable(
  'deployments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    repository: varchar('repository', { length: 500 }).notNull(),
    branch: varchar('branch', { length: 255 }).notNull().default('main'),
    buildCommand: varchar('build_command', { length: 500 }),
    startCommand: varchar('start_command', { length: 500 }),
    envVars: jsonb('env_vars').$type<Record<string, string>>(),
    status: deploymentStatusEnum('status').notNull().default('pending'),
    logs: text('logs'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('deployments_domain_id_idx').on(t.domainId)],
);

// ─── Metrics ──────────────────────────────────────────────────────────────────
export const metrics = pgTable(
  'metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    cpuUsage: real('cpu_usage').notNull(),
    ramUsage: real('ram_usage').notNull(),
    diskUsage: real('disk_usage').notNull(),
    networkUsage: jsonb('network_usage').$type<{ rx: number; tx: number }>().notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (t) => [
    index('metrics_server_id_ts_idx').on(t.serverId, t.timestamp),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  servers: many(servers),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  user: one(users, { fields: [servers.userId], references: [users.id] }),
  domains: many(domains),
  metrics: many(metrics),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  server: one(servers, { fields: [domains.serverId], references: [servers.id] }),
  dnsRecords: many(dnsRecords),
  deployments: many(deployments),
}));

export const dnsRecordsRelations = relations(dnsRecords, ({ one }) => ({
  domain: one(domains, { fields: [dnsRecords.domainId], references: [domains.id] }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  domain: one(domains, { fields: [deployments.domainId], references: [domains.id] }),
}));

export const metricsRelations = relations(metrics, ({ one }) => ({
  server: one(servers, { fields: [metrics.serverId], references: [servers.id] }),
}));

// ─── Type Exports ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type NewDnsRecord = typeof dnsRecords.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type Metric = typeof metrics.$inferSelect;
export type NewMetric = typeof metrics.$inferInsert;
