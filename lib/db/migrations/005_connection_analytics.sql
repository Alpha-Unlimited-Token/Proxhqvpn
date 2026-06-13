-- Patch 32: VPN connection analytics table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS vpn_connection_events (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  node_id TEXT,
  event_type TEXT NOT NULL,
  region TEXT,
  latency_ms INTEGER,
  bytes_in BIGINT,
  bytes_out BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpn_connection_events_user_created
  ON vpn_connection_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vpn_connection_events_node_created
  ON vpn_connection_events(node_id, created_at DESC);
