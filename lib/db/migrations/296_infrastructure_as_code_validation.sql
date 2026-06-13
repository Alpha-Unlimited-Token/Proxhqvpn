CREATE TABLE IF NOT EXISTS patch_296_infrastructure_as_code_validation (
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

CREATE INDEX IF NOT EXISTS idx_patch_296_infrastructure_as_code_validation_tenant_status
  ON patch_296_infrastructure_as_code_validation(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_296_infrastructure_as_code_validation_user_created
  ON patch_296_infrastructure_as_code_validation(user_id, created_at DESC);
