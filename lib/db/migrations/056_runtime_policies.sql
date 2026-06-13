-- Patch 133: Runtime policy engine
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS runtime_policies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny', 'warn')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
