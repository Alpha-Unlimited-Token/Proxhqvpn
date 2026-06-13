-- Patch 43: DNS routing policies table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS dns_routing_policies (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  upstreams JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dns_routing_policies_user
  ON dns_routing_policies(user_id, enabled);
