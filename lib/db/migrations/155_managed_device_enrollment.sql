-- Patch 155: Managed-device enrollment
CREATE TABLE IF NOT EXISTS patch_155_managed_device_enrollment (
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

CREATE INDEX IF NOT EXISTS idx_patch_155_managed_device_enrollment_tenant_status
  ON patch_155_managed_device_enrollment(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_155_managed_device_enrollment_user_created
  ON patch_155_managed_device_enrollment(user_id, created_at DESC);
