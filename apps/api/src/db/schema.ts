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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'user']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'expired',
]);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'open', 'paid', 'void', 'uncollectible',
]);
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
export const testDbTypeEnum = pgEnum('test_db_type', ['postgres', 'mysql', 'mongo']);
export const testDbStatusEnum = pgEnum('test_db_status', ['creating', 'running', 'stopped', 'error']);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  suspended: boolean('suspended').notNull().default(false),
  suspendedAt: timestamp('suspended_at'),
  suspendedReason: text('suspended_reason'),
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
    sshAuthType: varchar('ssh_auth_type', { length: 10 }).notNull().default('key'),
    sshKey: text('ssh_key'),
    sshPassword: text('ssh_password'),
    status: serverStatusEnum('status').notNull().default('pending'),
    agentVersion: varchar('agent_version', { length: 50 }),
    scanData: jsonb('scan_data').$type<Record<string, unknown>>(),
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
    domain: varchar('domain', { length: 255 }).notNull(),
    rootPath: varchar('root_path', { length: 500 }).notNull().default('/var/www'),
    port: integer('port').notNull().default(3000),
    sslEnabled: boolean('ssl_enabled').notNull().default(false),
    sslEmail: varchar('ssl_email', { length: 255 }),
    status: domainStatusEnum('status').notNull().default('pending'),
    githubRepo: varchar('github_repo', { length: 500 }),
    githubBranch: varchar('github_branch', { length: 100 }).default('main'),
    deployCommand: varchar('deploy_command', { length: 500 }),
    webhookSecret: varchar('webhook_secret', { length: 100 }),
    lastDeployAt: timestamp('last_deploy_at'),
    deployLog: text('deploy_log'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('domains_server_id_idx').on(t.serverId),
    uniqueIndex('domains_server_domain_unique').on(t.serverId, t.domain),
  ],
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

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  status: subscriptionStatusEnum('status').notNull().default('trialing'),
  billingPeriod: varchar('billing_period', { length: 10 }).notNull().default('monthly'),
  trialEndsAt: timestamp('trial_ends_at').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
  stripePriceId: varchar('stripe_price_id', { length: 100 }),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('subs_user_id_idx').on(t.userId)]);

// ─── Billing Info ─────────────────────────────────────────────────────────────
export const billingInfo = pgTable('billing_info', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  companyName: varchar('company_name', { length: 200 }),
  taxId: varchar('tax_id', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).default('TR'),
  billingEmail: varchar('billing_email', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 100 }),
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('usd'),
  status: invoiceStatusEnum('status').notNull().default('open'),
  billingSnapshot: jsonb('billing_snapshot').$type<Record<string, string>>(),
  pdfUrl: text('pdf_url'),
  hostedUrl: text('hosted_url'),
  paidAt: timestamp('paid_at'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('invoices_user_id_idx').on(t.userId)]);

// ─── Webhook Events ───────────────────────────────────────────────────────────
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeEventId: varchar('stripe_event_id', { length: 100 }).unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  processed: boolean('processed').notNull().default(false),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('webhook_events_type_idx').on(t.eventType),
  index('webhook_events_created_idx').on(t.createdAt),
]);

// ─── Domain Analysis Reports ──────────────────────────────────────────────────
export const seoReports = pgTable(
  'seo_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }),
    metaDescription: text('meta_description'),
    h1Tags: jsonb('h1_tags').$type<string[]>().notNull().default([]),
    loadTimeMs: integer('load_time_ms').notNull().default(0),
    mobileFriendly: boolean('mobile_friendly').notNull().default(false),
    lighthouseScore: integer('lighthouse_score'),
    brokenLinksCount: integer('broken_links_count').notNull().default(0),
    sitemapExists: boolean('sitemap_exists').notNull().default(false),
    robotsTxtExists: boolean('robots_txt_exists').notNull().default(false),
    seoScore: integer('seo_score').notNull().default(0),
    rawData: jsonb('raw_data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('seo_reports_domain_id_idx').on(t.domainId), index('seo_reports_created_at_idx').on(t.createdAt)],
);

export const stressTestReports = pgTable(
  'stress_test_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    requestsPerSecond: real('requests_per_second').notNull().default(0),
    avgResponseTimeMs: real('avg_response_time_ms').notNull().default(0),
    maxResponseTimeMs: real('max_response_time_ms').notNull().default(0),
    errorRate: real('error_rate').notNull().default(0),
    concurrentUsers: integer('concurrent_users').notNull().default(0),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    rawData: jsonb('raw_data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('stress_test_reports_domain_id_idx').on(t.domainId),
    index('stress_test_reports_created_at_idx').on(t.createdAt),
  ],
);

export const securityScanReports = pgTable(
  'security_scan_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    securityScore: integer('security_score').notNull().default(0),
    httpsEnabled: boolean('https_enabled').notNull().default(false),
    securityHeaders: jsonb('security_headers').$type<Record<string, string>>().notNull().default({}),
    openPorts: jsonb('open_ports').$type<number[]>().notNull().default([]),
    vulnerabilities: jsonb('vulnerabilities').$type<string[]>().notNull().default([]),
    sslValid: boolean('ssl_valid').notNull().default(false),
    directoryListingEnabled: boolean('directory_listing_enabled').notNull().default(false),
    rawData: jsonb('raw_data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('security_scan_reports_domain_id_idx').on(t.domainId),
    index('security_scan_reports_created_at_idx').on(t.createdAt),
  ],
);

// ─── Test Databases (demo DBs on platform server; serverId null = demo host from env) ─
export const testDatabases = pgTable(
  'test_databases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serverId: uuid('server_id').references(() => servers.id, { onDelete: 'cascade' }),
    type: testDbTypeEnum('type').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    host: varchar('host', { length: 255 }).notNull(),
    port: integer('port').notNull(),
    username: varchar('username', { length: 100 }).notNull(),
    password: text('password').notNull(),
    databaseName: varchar('database_name', { length: 255 }).notNull(),
    storageLimitMb: integer('storage_limit_mb').notNull().default(100),
    storageUsedMb: integer('storage_used_mb'),
    status: testDbStatusEnum('status').notNull().default('creating'),
    containerName: varchar('container_name', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('test_databases_user_id_idx').on(t.userId),
    index('test_databases_server_id_idx').on(t.serverId),
    index('test_databases_status_idx').on(t.status),
  ],
);

// ─── Server DB connections (sunucudaki MySQL/Postgres bağlantı bilgileri) ──────
export const serverDbConnectionTypeEnum = pgEnum('server_db_connection_type', ['mysql', 'postgres']);

export const serverDbConnections = pgTable(
  'server_db_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: serverDbConnectionTypeEnum('type').notNull(),
    host: varchar('host', { length: 255 }).notNull().default('127.0.0.1'),
    port: integer('port').notNull().default(3306),
    username: varchar('username', { length: 255 }).notNull(),
    password: text('password').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('server_db_connections_server_id_idx').on(t.serverId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many, one }) => ({
  servers: many(servers),
  subscription: one(subscriptions, { fields: [users.id], references: [subscriptions.userId] }),
  billingInfo: one(billingInfo, { fields: [users.id], references: [billingInfo.userId] }),
  invoices: many(invoices),
  testDatabases: many(testDatabases),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));
export const billingInfoRelations = relations(billingInfo, ({ one }) => ({
  user: one(users, { fields: [billingInfo.userId], references: [users.id] }),
}));
export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  user: one(users, { fields: [servers.userId], references: [users.id] }),
  domains: many(domains),
  metrics: many(metrics),
  testDatabases: many(testDatabases),
  serverDbConnections: many(serverDbConnections),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  server: one(servers, { fields: [domains.serverId], references: [servers.id] }),
  dnsRecords: many(dnsRecords),
  deployments: many(deployments),
  seoReports: many(seoReports),
  stressTestReports: many(stressTestReports),
  securityScanReports: many(securityScanReports),
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

export const seoReportsRelations = relations(seoReports, ({ one }) => ({
  domain: one(domains, { fields: [seoReports.domainId], references: [domains.id] }),
}));
export const stressTestReportsRelations = relations(stressTestReports, ({ one }) => ({
  domain: one(domains, { fields: [stressTestReports.domainId], references: [domains.id] }),
}));
export const securityScanReportsRelations = relations(securityScanReports, ({ one }) => ({
  domain: one(domains, { fields: [securityScanReports.domainId], references: [domains.id] }),
}));

export const testDatabasesRelations = relations(testDatabases, ({ one }) => ({
  user: one(users, { fields: [testDatabases.userId], references: [users.id] }),
  server: one(servers, { fields: [testDatabases.serverId], references: [servers.id] }),
}));

export const serverDbConnectionsRelations = relations(serverDbConnections, ({ one }) => ({
  server: one(servers, { fields: [serverDbConnections.serverId], references: [servers.id] }),
}));

// webhookEvents has no FK relations — standalone table

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
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type BillingInfo = typeof billingInfo.$inferSelect;
export type NewBillingInfo = typeof billingInfo.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type SeoReportRow = typeof seoReports.$inferSelect;
export type NewSeoReportRow = typeof seoReports.$inferInsert;
export type StressTestReportRow = typeof stressTestReports.$inferSelect;
export type NewStressTestReportRow = typeof stressTestReports.$inferInsert;
export type SecurityScanReportRow = typeof securityScanReports.$inferSelect;
export type NewSecurityScanReportRow = typeof securityScanReports.$inferInsert;
export type TestDatabase = typeof testDatabases.$inferSelect;
export type NewTestDatabase = typeof testDatabases.$inferInsert;
export type ServerDbConnection = typeof serverDbConnections.$inferSelect;
export type NewServerDbConnection = typeof serverDbConnections.$inferInsert;
