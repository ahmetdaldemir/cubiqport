-- CubiqPort — Servers: password auth (ssh_key nullable, ssh_auth_type, ssh_password)

-- Allow NULL ssh_key when using password auth
ALTER TABLE servers ALTER COLUMN ssh_key DROP NOT NULL;

-- Add password auth columns if missing
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_auth_type VARCHAR(10) NOT NULL DEFAULT 'key';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;

-- App expects scan_data (metrics/scan result)
ALTER TABLE servers ADD COLUMN IF NOT EXISTS scan_data JSONB;
