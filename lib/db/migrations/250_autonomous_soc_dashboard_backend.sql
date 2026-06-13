CREATE TABLE IF NOT EXISTS patch_250_autonomous_soc_dashboard_backend (
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

CREATE INDEX IF NOT EXISTS idx_patch_250_autonomous_soc_dashboard_backend_tenant_status
  ON patch_250_autonomous_soc_dashboard_backend(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_250_autonomous_soc_dashboard_backend_user_created
  ON patch_250_autonomous_soc_dashboard_backend(user_id, created_at DESC);
