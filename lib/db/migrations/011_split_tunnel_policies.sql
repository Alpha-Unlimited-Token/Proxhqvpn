-- Patch 42: Split tunnel policies table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS split_tunnel_policies (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('include', 'exclude')),
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_split_tunnel_policies_user
  ON split_tunnel_policies(user_id, enabled);
