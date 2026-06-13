-- Patch 221: Queue lag score
CREATE TABLE IF NOT EXISTS patch_221_queue_lag_score (
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

CREATE INDEX IF NOT EXISTS idx_patch_221_queue_lag_score_tenant_status
  ON patch_221_queue_lag_score(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_221_queue_lag_score_user_created
  ON patch_221_queue_lag_score(user_id, created_at DESC);
