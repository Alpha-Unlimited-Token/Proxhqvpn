-- Patch 96: Backup validation runs table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS backup_validation_runs (
  id UUID PRIMARY KEY,
  backup_uri TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed')),
  checksum TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
