-- Patch 62: Policy versions table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY,
  policy_type TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(policy_type, policy_id, version)
);
