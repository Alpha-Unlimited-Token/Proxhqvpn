-- Patch 37: Node maintenance windows table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS node_maintenance_windows (
  id UUID PRIMARY KEY,
  node_id TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_maintenance_due
  ON node_maintenance_windows(node_id, starts_at, ends_at, status);
