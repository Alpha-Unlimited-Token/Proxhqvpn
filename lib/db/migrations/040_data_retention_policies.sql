-- Patch 84: Data retention policy tables
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  table_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, table_name)
);

CREATE TABLE IF NOT EXISTS data_retention_runs (
  id UUID PRIMARY KEY,
  policy_id UUID NOT NULL,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
