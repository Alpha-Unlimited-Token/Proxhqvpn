-- Patch 72: Response playbooks table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS response_playbooks (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
