-- Patch 213: SLA reporting
CREATE TABLE IF NOT EXISTS patch_213_sla_reporting (
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

CREATE INDEX IF NOT EXISTS idx_patch_213_sla_reporting_tenant_status
  ON patch_213_sla_reporting(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_213_sla_reporting_user_created
  ON patch_213_sla_reporting(user_id, created_at DESC);
