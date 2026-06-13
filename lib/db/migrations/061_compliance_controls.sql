-- Patch 140: Compliance controls and assessments
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS compliance_controls (
  id UUID PRIMARY KEY,
  framework TEXT NOT NULL,
  control_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(framework, control_id)
);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id UUID PRIMARY KEY,
  framework TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
