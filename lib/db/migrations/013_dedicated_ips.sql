-- Patch 44: Dedicated IPs table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS dedicated_ips (
  id UUID PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  region TEXT,
  node_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('available', 'assigned', 'reserved', 'disabled')),
  assigned_user_id TEXT,
  assigned_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dedicated_ips_status_region
  ON dedicated_ips(status, region);
