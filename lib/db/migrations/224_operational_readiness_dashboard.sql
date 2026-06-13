-- Patch 224: Operational readiness dashboard
CREATE TABLE IF NOT EXISTS patch_224_operational_readiness_dashboard (
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

CREATE INDEX IF NOT EXISTS idx_patch_224_operational_readiness_dashboard_tenant_status
  ON patch_224_operational_readiness_dashboard(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_224_operational_readiness_dashboard_user_created
  ON patch_224_operational_readiness_dashboard(user_id, created_at DESC);
