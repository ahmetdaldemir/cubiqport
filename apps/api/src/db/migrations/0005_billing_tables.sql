-- CubiqPort — Billing: subscriptions, billing_info, invoices, webhook_events

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status                  subscription_status NOT NULL DEFAULT 'trialing',
  billing_period          VARCHAR(10) NOT NULL DEFAULT 'monthly',
  trial_ends_at           TIMESTAMP NOT NULL,
  stripe_customer_id      VARCHAR(100),
  stripe_subscription_id  VARCHAR(100),
  stripe_price_id         VARCHAR(100),
  current_period_end      TIMESTAMP,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subs_user_id_idx ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS billing_info (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  company_name VARCHAR(200),
  tax_id       VARCHAR(50),
  address      TEXT,
  city         VARCHAR(100),
  country      VARCHAR(100) DEFAULT 'TR',
  billing_email VARCHAR(255),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(100),
  invoice_number    VARCHAR(50),
  amount_cents      INTEGER NOT NULL,
  currency          VARCHAR(10) NOT NULL DEFAULT 'usd',
  status            invoice_status NOT NULL DEFAULT 'open',
  billing_snapshot  JSONB,
  pdf_url           TEXT,
  hosted_url        TEXT,
  paid_at           TIMESTAMP,
  period_start      TIMESTAMP,
  period_end        TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices(user_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(100) UNIQUE,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  processed       BOOLEAN NOT NULL DEFAULT false,
  error           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER billing_info_updated_at   BEFORE UPDATE ON billing_info   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mevcut kullanıcılar için trialing subscription (7 gün)
INSERT INTO subscriptions (user_id, status, billing_period, trial_ends_at)
  SELECT id, 'trialing', 'monthly', NOW() + INTERVAL '7 days'
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id);
