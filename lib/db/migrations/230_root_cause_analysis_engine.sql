-- Patch 230: Root-cause analysis engine
CREATE TABLE IF NOT EXISTS patch_230_root_cause_analysis_engine (
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

CREATE INDEX IF NOT EXISTS idx_patch_230_root_cause_analysis_engine_tenant_status
  ON patch_230_root_cause_analysis_engine(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_230_root_cause_analysis_engine_user_created
  ON patch_230_root_cause_analysis_engine(user_id, created_at DESC);
