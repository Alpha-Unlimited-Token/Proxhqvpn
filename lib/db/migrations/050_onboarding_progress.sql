-- Patch 115: Onboarding progress table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  step TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, step)
);
