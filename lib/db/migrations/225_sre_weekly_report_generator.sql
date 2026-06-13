-- Patch 225: SRE weekly report generator
CREATE TABLE IF NOT EXISTS patch_225_sre_weekly_report_generator (
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

CREATE INDEX IF NOT EXISTS idx_patch_225_sre_weekly_report_generator_tenant_status
  ON patch_225_sre_weekly_report_generator(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_225_sre_weekly_report_generator_user_created
  ON patch_225_sre_weekly_report_generator(user_id, created_at DESC);
