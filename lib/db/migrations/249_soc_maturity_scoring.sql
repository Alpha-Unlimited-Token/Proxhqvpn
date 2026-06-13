CREATE TABLE IF NOT EXISTS patch_249_soc_maturity_scoring (
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

CREATE INDEX IF NOT EXISTS idx_patch_249_soc_maturity_scoring_tenant_status
  ON patch_249_soc_maturity_scoring(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_249_soc_maturity_scoring_user_created
  ON patch_249_soc_maturity_scoring(user_id, created_at DESC);
