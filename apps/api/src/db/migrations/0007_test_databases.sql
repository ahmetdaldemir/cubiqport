-- CubiqPort — Test Database Service (PostgreSQL, MySQL, MongoDB in Docker)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_db_type') THEN
    CREATE TYPE test_db_type AS ENUM ('postgres', 'mysql', 'mongo');
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_db_status') THEN
    CREATE TYPE test_db_status AS ENUM ('creating', 'running', 'stopped', 'error');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS test_databases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id         UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type              test_db_type NOT NULL,
  name              VARCHAR(100) NOT NULL,
  host              VARCHAR(255) NOT NULL,
  port              INTEGER NOT NULL,
  username          VARCHAR(100) NOT NULL,
  password          TEXT NOT NULL,
  database_name     VARCHAR(255) NOT NULL,
  storage_limit_mb  INTEGER NOT NULL DEFAULT 100,
  storage_used_mb   INTEGER,
  status            test_db_status NOT NULL DEFAULT 'creating',
  container_name    VARCHAR(255),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS test_databases_user_id_idx ON test_databases(user_id);
CREATE INDEX IF NOT EXISTS test_databases_server_id_idx ON test_databases(server_id);
CREATE INDEX IF NOT EXISTS test_databases_status_idx ON test_databases(status);
