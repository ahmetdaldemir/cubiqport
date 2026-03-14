-- Allow same domain name on different servers: unique per (server_id, domain)
-- Drop global unique on domain, add composite unique (server_id, domain)

ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_domain_key;
CREATE UNIQUE INDEX IF NOT EXISTS domains_server_domain_unique ON domains(server_id, domain);
