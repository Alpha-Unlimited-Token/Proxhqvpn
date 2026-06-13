-- Patch 166: Tenant-level security policies
CREATE TABLE IF NOT EXISTS patch_166_tenant_level_security_policies (
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

CREATE INDEX IF NOT EXISTS idx_patch_166_tenant_level_security_policies_tenant_status
  ON patch_166_tenant_level_security_policies(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_166_tenant_level_security_policies_user_created
  ON patch_166_tenant_level_security_policies(user_id, created_at DESC);
