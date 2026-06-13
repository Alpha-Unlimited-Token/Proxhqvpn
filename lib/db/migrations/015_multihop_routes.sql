-- Patch 47: Multi-hop routes table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS multihop_routes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  entry_node_id TEXT NOT NULL,
  exit_node_id TEXT NOT NULL,
  region_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multihop_routes_user
  ON multihop_routes(user_id, status);
