-- Patch 64: Security cases table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS security_cases (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT,
  subject TEXT,
  timeline_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_security_cases_status_severity
  ON security_cases(status, severity, created_at DESC);
