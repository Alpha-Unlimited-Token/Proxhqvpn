-- Patch 159: Temporary access grants
CREATE TABLE IF NOT EXISTS patch_159_temporary_access_grants (
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

CREATE INDEX IF NOT EXISTS idx_patch_159_temporary_access_grants_tenant_status
  ON patch_159_temporary_access_grants(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_159_temporary_access_grants_user_created
  ON patch_159_temporary_access_grants(user_id, created_at DESC);
