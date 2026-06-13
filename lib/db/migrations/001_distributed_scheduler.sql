-- Patch 23: Distributed scheduler table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY,
  task_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'cancelled')),
  run_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
  ON scheduled_tasks(status, run_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_locked
  ON scheduled_tasks(locked_at)
  WHERE status = 'running';
