-- Patch 207: Synthetic monitoring jobs
CREATE TABLE IF NOT EXISTS patch_207_synthetic_monitoring_jobs (
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

CREATE INDEX IF NOT EXISTS idx_patch_207_synthetic_monitoring_jobs_tenant_status
  ON patch_207_synthetic_monitoring_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_207_synthetic_monitoring_jobs_user_created
  ON patch_207_synthetic_monitoring_jobs(user_id, created_at DESC);
