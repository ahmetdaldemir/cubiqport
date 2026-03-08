-- CubiqPort — Domain Analysis: seo_reports, stress_test_reports, security_scan_reports

CREATE TABLE IF NOT EXISTS seo_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id            UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  title                VARCHAR(500),
  meta_description     TEXT,
  h1_tags              JSONB NOT NULL DEFAULT '[]',
  load_time_ms         INTEGER NOT NULL DEFAULT 0,
  mobile_friendly      BOOLEAN NOT NULL DEFAULT false,
  lighthouse_score    INTEGER,
  broken_links_count   INTEGER NOT NULL DEFAULT 0,
  sitemap_exists       BOOLEAN NOT NULL DEFAULT false,
  robots_txt_exists    BOOLEAN NOT NULL DEFAULT false,
  seo_score            INTEGER NOT NULL DEFAULT 0,
  raw_data             JSONB,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS seo_reports_domain_id_idx ON seo_reports(domain_id);
CREATE INDEX IF NOT EXISTS seo_reports_created_at_idx ON seo_reports(created_at);

CREATE TABLE IF NOT EXISTS stress_test_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id             UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  requests_per_second   REAL NOT NULL DEFAULT 0,
  avg_response_time_ms  REAL NOT NULL DEFAULT 0,
  max_response_time_ms  REAL NOT NULL DEFAULT 0,
  error_rate            REAL NOT NULL DEFAULT 0,
  concurrent_users      INTEGER NOT NULL DEFAULT 0,
  duration_seconds      INTEGER NOT NULL DEFAULT 0,
  raw_data              JSONB,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stress_test_reports_domain_id_idx ON stress_test_reports(domain_id);
CREATE INDEX IF NOT EXISTS stress_test_reports_created_at_idx ON stress_test_reports(created_at);

CREATE TABLE IF NOT EXISTS security_scan_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id                   UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  security_score              INTEGER NOT NULL DEFAULT 0,
  https_enabled               BOOLEAN NOT NULL DEFAULT false,
  security_headers            JSONB NOT NULL DEFAULT '{}',
  open_ports                  JSONB NOT NULL DEFAULT '[]',
  vulnerabilities             JSONB NOT NULL DEFAULT '[]',
  ssl_valid                   BOOLEAN NOT NULL DEFAULT false,
  directory_listing_enabled   BOOLEAN NOT NULL DEFAULT false,
  raw_data                    JSONB,
  created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_scan_reports_domain_id_idx ON security_scan_reports(domain_id);
CREATE INDEX IF NOT EXISTS security_scan_reports_created_at_idx ON security_scan_reports(created_at);
