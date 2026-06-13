-- Patch 55: Security alerts table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'open',
  source_event_id TEXT,
  subject TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_status_priority
  ON security_alerts(status, priority DESC, created_at DESC);
