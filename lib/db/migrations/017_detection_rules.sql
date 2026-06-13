-- Patch 51: Detection rules table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS detection_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  event_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detection_rules_enabled_type
  ON detection_rules(enabled, event_type);
