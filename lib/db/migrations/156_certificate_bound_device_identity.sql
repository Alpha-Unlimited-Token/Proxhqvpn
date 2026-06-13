-- Patch 156: Certificate-bound device identity
CREATE TABLE IF NOT EXISTS patch_156_certificate_bound_device_identity (
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

CREATE INDEX IF NOT EXISTS idx_patch_156_certificate_bound_device_identity_tenant_status
  ON patch_156_certificate_bound_device_identity(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_156_certificate_bound_device_identity_user_created
  ON patch_156_certificate_bound_device_identity(user_id, created_at DESC);
