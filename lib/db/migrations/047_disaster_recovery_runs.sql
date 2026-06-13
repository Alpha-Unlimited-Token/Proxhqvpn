-- Patch 97: Disaster recovery runs table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS disaster_recovery_runs (
  id UUID PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  started_by TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
