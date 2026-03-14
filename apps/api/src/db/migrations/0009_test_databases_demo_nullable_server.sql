-- Demo test databases: created on platform server, not user server. server_id nullable.
ALTER TABLE test_databases ALTER COLUMN server_id DROP NOT NULL;
-- Keep FK: when server_id is set it must reference servers(id). When null = demo host from env.
