-- Patch 52: Security events table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  actor TEXT,
  subject TEXT,
  normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON security_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_severity_created
  ON security_events(severity, created_at DESC);
