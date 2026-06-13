-- Patch 70: Detection tests table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS detection_tests (
  id UUID PRIMARY KEY,
  rule_id UUID,
  name TEXT NOT NULL,
  event_sample JSONB NOT NULL,
  expected_match BOOLEAN NOT NULL,
  last_result BOOLEAN,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
