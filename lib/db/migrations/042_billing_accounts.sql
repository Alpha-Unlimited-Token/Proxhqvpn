-- Patch 86: Billing accounts table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id TEXT,
  billing_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_user
  ON billing_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_tenant
  ON billing_accounts(tenant_id);
