-- Patch 49: Tunnel recovery events table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS tunnel_recovery_events (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  failed_node_id TEXT,
  recovery_node_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tunnel_recovery_user_created
  ON tunnel_recovery_events(user_id, created_at DESC);
