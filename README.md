# CubiqPort

A production-ready server orchestration platform — manage servers, domains, DNS, SSL, deployments and monitoring from a single control panel.

---

## Architecture

```
cubiqport/
├── apps/
│   ├── api/          # Fastify REST API (Node.js + PostgreSQL + Redis)
│   ├── web/          # Next.js 14 dashboard (App Router + Tailwind + shadcn/ui)
│   └── agent/        # Lightweight HTTP agent running on each managed server
└── packages/
    └── shared/       # Shared TypeScript types, Zod schemas, constants
```

### Component overview

| Component | Purpose |
|-----------|---------|
| **API** | Auth, server/domain/DNS/deployment management, metrics ingestion |
| **Agent** | Runs on managed servers; executes deployments, manages nginx + SSL, streams metrics |
| **Web** | Developer dashboard — servers, domains, deployments, real-time monitoring |

---

## Tech stack

- **Backend**: Node.js 20, Fastify 4, Drizzle ORM, PostgreSQL 16, Redis 7
- **Frontend**: Next.js 14 (App Router), TailwindCSS 3, shadcn/ui, Recharts
- **Infrastructure**: Docker, nginx, Certbot (Let's Encrypt), Cloudflare API
- **Auth**: JWT (HS256), bcrypt password hashing, AES-256-GCM credential encryption
- **Monorepo**: npm workspaces + Turborepo

---

## Quick start (development)

### Prerequisites
- Node.js ≥ 20
- Docker + Docker Compose

### 1. Clone & install

```bash
git clone https://github.com/you/cubiqport
cd cubiqport
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY (64-char hex), AGENT_SECRET
# Optionally set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID
```

### 3. Start infrastructure

```bash
docker compose up postgres redis -d
```

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start dev servers

```bash
npm run dev
```

- API:  http://localhost:4000
- Web:  http://localhost:3000
- Swagger docs: http://localhost:4000/docs

---

## API reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login → JWT |
| GET  | `/api/v1/auth/me` | Current user |

### Servers

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/servers` | List servers |
| POST   | `/api/v1/servers` | Add server |
| PATCH  | `/api/v1/servers/:id` | Update server |
| DELETE | `/api/v1/servers/:id` | Remove server |
| POST   | `/api/v1/servers/:id/test-connection` | Test SSH |
| POST   | `/api/v1/servers/:id/provision` | Install agent |
| GET    | `/api/v1/servers/:id/agent/ping` | Ping agent |

### Domains

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/domains` | List domains |
| POST   | `/api/v1/domains` | Create domain (auto DNS + nginx) |
| PATCH  | `/api/v1/domains/:id` | Update domain |
| DELETE | `/api/v1/domains/:id` | Delete domain |
| POST   | `/api/v1/domains/:id/ssl` | Enable SSL |

### DNS

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/dns?domainId=` | List DNS records |
| POST   | `/api/v1/dns` | Create record (syncs Cloudflare) |
| DELETE | `/api/v1/dns/:id` | Delete record |

### Deployments

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/deployments?domainId=` | List deployments |
| POST   | `/api/v1/deployments` | Trigger deployment |
| POST   | `/api/v1/deployments/:id/cancel` | Cancel deployment |

### Monitoring

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/monitoring/servers/:id/live` | Live metrics (Redis cache) |
| GET    | `/api/v1/monitoring/servers/:id/history` | Historical metrics |
| POST   | `/api/v1/monitoring/servers/:id/ingest` | Agent metrics push |

---

## Agent

The agent runs as a systemd service on each managed server.

### Installation

Automatically installed via `POST /api/v1/servers/:id/provision`.

Manual install:
```bash
npm install -g @cubiqport/agent
cp apps/agent/cubiq-agent.service /etc/systemd/system/
systemctl enable --now cubiq-agent
```

### Environment (`/etc/cubiq-agent.env`)

```
AGENT_PORT=9000
AGENT_SECRET=your-shared-secret
CUBIQ_API_URL=https://your-api.example.com
CUBIQ_SERVER_ID=uuid-of-server
```

### Agent endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/health` | Health check (no auth) |
| GET  | `/metrics` | CPU, RAM, disk, net, containers |
| POST | `/nginx/create` | Write nginx config + reload |
| POST | `/ssl/install` | Run certbot |
| POST | `/deploy` | Clone repo + build + run container |

---

## Domain creation flow

When `POST /api/v1/domains` is called:

```
1. Validate server is active
2. Persist domain record (status: pending)
3. ── Async orchestration ──────────────────────
   3a. Create Cloudflare DNS A record → domain → server IP
   3b. Store DNS record in DB
   3c. Call agent POST /nginx/create
       Agent writes /etc/nginx/sites-available/<domain>.conf
       Creates symlink in sites-enabled
       Tests config syntax
       Reloads nginx
   3d. Update domain status → active
```

---

## Security

- SSH keys stored AES-256-GCM encrypted at rest
- JWT authentication on all API routes
- Agent protected by shared HMAC secret (`X-Agent-Secret` header)
- Rate limiting: 200 req/min per IP
- Helmet security headers on both API and agent
- Passwords hashed with bcrypt (12 rounds)

---

## Database schema

See `apps/api/src/db/schema.ts` for the full Drizzle ORM schema.

Tables: `users`, `servers`, `domains`, `dns_records`, `deployments`, `metrics`
