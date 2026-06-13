-- Patch 88: Licenses table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  license_key_hash TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  seat_limit INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
