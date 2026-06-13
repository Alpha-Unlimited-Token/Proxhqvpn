-- Patch 135: Secret reference registry
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS secret_references (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'env',
  reference TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
