-- Patch 53: Threat intelligence indicators table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS threat_intel_indicators (
  id UUID PRIMARY KEY,
  indicator_type TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  severity TEXT NOT NULL DEFAULT 'medium',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(indicator_type, value, source)
);

CREATE INDEX IF NOT EXISTS idx_threat_intel_value
  ON threat_intel_indicators(value);

CREATE INDEX IF NOT EXISTS idx_threat_intel_type
  ON threat_intel_indicators(indicator_type);
