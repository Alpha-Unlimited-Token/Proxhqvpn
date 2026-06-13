CREATE TABLE IF NOT EXISTS patch_300_final_platform_self_audit_and_zip_packaging (
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

CREATE INDEX IF NOT EXISTS idx_patch_300_final_platform_self_audit_and_zip_packaging_tenant_status
  ON patch_300_final_platform_self_audit_and_zip_packaging(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_300_final_platform_self_audit_and_zip_packaging_user_created
  ON patch_300_final_platform_self_audit_and_zip_packaging(user_id, created_at DESC);
