CREATE TABLE IF NOT EXISTS patch_266_custom_domain_management (
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

CREATE INDEX IF NOT EXISTS idx_patch_266_custom_domain_management_tenant_status
  ON patch_266_custom_domain_management(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_266_custom_domain_management_user_created
  ON patch_266_custom_domain_management(user_id, created_at DESC);
