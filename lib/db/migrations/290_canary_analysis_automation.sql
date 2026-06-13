CREATE TABLE IF NOT EXISTS patch_290_canary_analysis_automation (
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

CREATE INDEX IF NOT EXISTS idx_patch_290_canary_analysis_automation_tenant_status
  ON patch_290_canary_analysis_automation(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_290_canary_analysis_automation_user_created
  ON patch_290_canary_analysis_automation(user_id, created_at DESC);
