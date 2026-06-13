-- Patch 181: Multi-cloud gateway registry
CREATE TABLE IF NOT EXISTS patch_181_multi_cloud_gateway_registry (
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

CREATE INDEX IF NOT EXISTS idx_patch_181_multi_cloud_gateway_registry_tenant_status
  ON patch_181_multi_cloud_gateway_registry(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_181_multi_cloud_gateway_registry_user_created
  ON patch_181_multi_cloud_gateway_registry(user_id, created_at DESC);
