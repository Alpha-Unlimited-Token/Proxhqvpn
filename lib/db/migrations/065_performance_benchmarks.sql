-- Patch 147: Performance benchmark runs
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS performance_benchmark_runs (
  id UUID PRIMARY KEY,
  benchmark_name TEXT NOT NULL,
  target TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
