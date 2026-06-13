-- Patch 126: Control-plane instance registry
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS control_plane_instances (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL UNIQUE,
  region TEXT,
  hostname TEXT,
  role TEXT NOT NULL DEFAULT 'worker',
  status TEXT NOT NULL DEFAULT 'active',
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_plane_instances_status
  ON control_plane_instances(status, last_heartbeat_at DESC);
