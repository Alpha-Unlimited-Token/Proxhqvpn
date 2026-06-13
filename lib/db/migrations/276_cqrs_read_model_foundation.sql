CREATE TABLE IF NOT EXISTS patch_276_cqrs_read_model_foundation (
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

CREATE INDEX IF NOT EXISTS idx_patch_276_cqrs_read_model_foundation_tenant_status
  ON patch_276_cqrs_read_model_foundation(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_276_cqrs_read_model_foundation_user_created
  ON patch_276_cqrs_read_model_foundation(user_id, created_at DESC);
