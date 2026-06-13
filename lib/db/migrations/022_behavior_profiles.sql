-- Patch 56: Behavior profiles table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS behavior_profiles (
  id UUID PRIMARY KEY,
  subject_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  baseline JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, subject_type)
);
