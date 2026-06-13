-- Patch 167: Per-tenant login policy
CREATE TABLE IF NOT EXISTS patch_167_per_tenant_login_policy (
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

CREATE INDEX IF NOT EXISTS idx_patch_167_per_tenant_login_policy_tenant_status
  ON patch_167_per_tenant_login_policy(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_167_per_tenant_login_policy_user_created
  ON patch_167_per_tenant_login_policy(user_id, created_at DESC);
