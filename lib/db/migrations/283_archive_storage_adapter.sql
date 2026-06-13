CREATE TABLE IF NOT EXISTS patch_283_archive_storage_adapter (
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

CREATE INDEX IF NOT EXISTS idx_patch_283_archive_storage_adapter_tenant_status
  ON patch_283_archive_storage_adapter(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_283_archive_storage_adapter_user_created
  ON patch_283_archive_storage_adapter(user_id, created_at DESC);
