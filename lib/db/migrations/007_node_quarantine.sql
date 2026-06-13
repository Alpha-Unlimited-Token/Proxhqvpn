-- Patch 36: Node quarantine events table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS node_quarantine_events (
  id UUID PRIMARY KEY,
  node_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quarantined',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_node_quarantine_node_created
  ON node_quarantine_events(node_id, created_at DESC);
