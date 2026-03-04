-- CubiqPort — Initial Schema
-- Generated: 2026-03-04

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE user_role           AS ENUM ('admin', 'user');
CREATE TYPE server_status       AS ENUM ('pending', 'active', 'error', 'offline');
CREATE TYPE domain_status       AS ENUM ('pending', 'active', 'error');
CREATE TYPE deployment_status   AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');
CREATE TYPE dns_type            AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV');

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        user_role    NOT NULL DEFAULT 'user',
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── Servers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  ip              VARCHAR(45)  NOT NULL,
  ssh_port        INTEGER      NOT NULL DEFAULT 22,
  ssh_user        VARCHAR(100) NOT NULL DEFAULT 'root',
  ssh_key         TEXT         NOT NULL,
  status          server_status NOT NULL DEFAULT 'pending',
  agent_version   VARCHAR(50),
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS servers_user_id_idx ON servers(user_id);

-- ─── Domains ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID          NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  domain      VARCHAR(255)  NOT NULL UNIQUE,
  root_path   VARCHAR(500)  NOT NULL DEFAULT '/var/www',
  port        INTEGER       NOT NULL DEFAULT 3000,
  ssl_enabled BOOLEAN       NOT NULL DEFAULT FALSE,
  ssl_email   VARCHAR(255),
  status      domain_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS domains_server_id_idx ON domains(server_id);

-- ─── DNS Records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dns_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id       UUID         NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  cloudflare_id   VARCHAR(255),
  type            dns_type     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  content         VARCHAR(255) NOT NULL,
  ttl             INTEGER      NOT NULL DEFAULT 1,
  proxied         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dns_domain_id_idx ON dns_records(domain_id);

-- ─── Deployments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id       UUID                NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  repository      VARCHAR(500)        NOT NULL,
  branch          VARCHAR(255)        NOT NULL DEFAULT 'main',
  build_command   VARCHAR(500),
  start_command   VARCHAR(500),
  env_vars        JSONB,
  status          deployment_status   NOT NULL DEFAULT 'pending',
  logs            TEXT,
  created_at      TIMESTAMP           NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP           NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deployments_domain_id_idx ON deployments(domain_id);

-- ─── Metrics ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       UUID      NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  cpu_usage       REAL      NOT NULL,
  ram_usage       REAL      NOT NULL,
  disk_usage      REAL      NOT NULL,
  network_usage   JSONB     NOT NULL,
  timestamp       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS metrics_server_id_ts_idx ON metrics(server_id, timestamp DESC);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER servers_updated_at  BEFORE UPDATE ON servers  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER domains_updated_at  BEFORE UPDATE ON domains  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER deployments_updated_at BEFORE UPDATE ON deployments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
