-- Patch 81: SAML connections table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS saml_connections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  sso_url TEXT NOT NULL,
  certificate TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
