-- Patch 203: Service dependency map
CREATE TABLE IF NOT EXISTS patch_203_service_dependency_map (
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

CREATE INDEX IF NOT EXISTS idx_patch_203_service_dependency_map_tenant_status
  ON patch_203_service_dependency_map(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_203_service_dependency_map_user_created
  ON patch_203_service_dependency_map(user_id, created_at DESC);
