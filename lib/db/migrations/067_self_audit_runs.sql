-- Patch 150: Continuous self-audit run history
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS self_audit_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'completed',
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
