-- Patch 191: Tunnel replay protection
CREATE TABLE IF NOT EXISTS patch_191_tunnel_replay_protection (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patch_191_tunnel_replay_protection_tenant_status
  ON patch_191_tunnel_replay_protection(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_191_tunnel_replay_protection_user_created
  ON patch_191_tunnel_replay_protection(user_id, created_at DESC);
