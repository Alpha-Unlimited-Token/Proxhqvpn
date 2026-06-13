-- Patch 149: Architecture decision records
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS architecture_decisions (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  context TEXT,
  decision TEXT NOT NULL,
  consequences TEXT,
  owner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
