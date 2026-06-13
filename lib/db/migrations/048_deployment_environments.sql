-- Patch 98: Deployment environments table (blue/green)
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS deployment_environments (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL CHECK (color IN ('blue', 'green')),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'standby',
  health JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
