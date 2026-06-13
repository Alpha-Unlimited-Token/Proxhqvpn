-- Patch 80: SCIM identities table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS scim_identities (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,
  display_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, external_id)
);
