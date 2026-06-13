-- Patch 54: IOC correlations table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS ioc_correlations (
  id UUID PRIMARY KEY,
  indicator_id UUID,
  event_id UUID,
  indicator_value TEXT NOT NULL,
  event_type TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  severity TEXT NOT NULL DEFAULT 'medium',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ioc_correlations_value
  ON ioc_correlations(indicator_value, created_at DESC);
