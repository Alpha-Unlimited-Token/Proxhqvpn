-- Patch 82: OIDC connections table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS oidc_connections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_ref TEXT,
  scopes JSONB NOT NULL DEFAULT '["openid","profile","email"]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
