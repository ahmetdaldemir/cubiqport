-- CubiqPort — Users: superadmin role + suspended fields
-- Required for auth plugin (suspended check) and admin role

-- Add superadmin to user_role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'superadmin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'superadmin';
  END IF;
END$$;

-- Add suspended columns to users (auth plugin expects these)
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
