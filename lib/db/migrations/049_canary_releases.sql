-- Patch 99: Canary releases table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS canary_releases (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  traffic_percent INTEGER NOT NULL DEFAULT 0 CHECK (traffic_percent >= 0 AND traffic_percent <= 100),
  status TEXT NOT NULL DEFAULT 'running',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
