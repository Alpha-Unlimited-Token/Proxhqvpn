-- Patch 71: SOAR workflow tables
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS soar_workflows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soar_workflow_runs (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL,
  trigger_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
