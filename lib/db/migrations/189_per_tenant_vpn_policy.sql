-- Patch 189: Per-tenant VPN policy
CREATE TABLE IF NOT EXISTS patch_189_per_tenant_vpn_policy (
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

CREATE INDEX IF NOT EXISTS idx_patch_189_per_tenant_vpn_policy_tenant_status
  ON patch_189_per_tenant_vpn_policy(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_189_per_tenant_vpn_policy_user_created
  ON patch_189_per_tenant_vpn_policy(user_id, created_at DESC);
