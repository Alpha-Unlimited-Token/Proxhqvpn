-- Patch 60: Zero Trust policies table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS zero_trust_policies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny', 'step_up')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zero_trust_policies_enabled_priority
  ON zero_trust_policies(enabled, priority ASC);
