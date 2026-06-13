CREATE TABLE IF NOT EXISTS patch_293_sbom_generation (
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

CREATE INDEX IF NOT EXISTS idx_patch_293_sbom_generation_tenant_status
  ON patch_293_sbom_generation(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_293_sbom_generation_user_created
  ON patch_293_sbom_generation(user_id, created_at DESC);
