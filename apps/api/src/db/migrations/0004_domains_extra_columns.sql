-- CubiqPort — Domains: deploy/github columns (app schema)

ALTER TABLE domains ADD COLUMN IF NOT EXISTS github_repo VARCHAR(500);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS github_branch VARCHAR(100) DEFAULT 'main';
ALTER TABLE domains ADD COLUMN IF NOT EXISTS deploy_command VARCHAR(500);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(100);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS last_deploy_at TIMESTAMP;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS deploy_log TEXT;
