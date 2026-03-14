-- Sunucu üzerindeki MySQL/PostgreSQL bağlantı bilgileri (veritabanları listeleme/yönetim)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'server_db_connection_type') THEN
    CREATE TYPE server_db_connection_type AS ENUM ('mysql', 'postgres');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS server_db_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id         UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  type              server_db_connection_type NOT NULL,
  host              VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
  port              INTEGER NOT NULL DEFAULT 3306,
  username          VARCHAR(255) NOT NULL,
  password          TEXT NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS server_db_connections_server_id_idx ON server_db_connections(server_id);
