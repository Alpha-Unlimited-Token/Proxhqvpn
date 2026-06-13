CREATE TABLE IF NOT EXISTS patch_240_detection_quality_scoring (
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

CREATE INDEX IF NOT EXISTS idx_patch_240_detection_quality_scoring_tenant_status
  ON patch_240_detection_quality_scoring(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_240_detection_quality_scoring_user_created
  ON patch_240_detection_quality_scoring(user_id, created_at DESC);
