CREATE TABLE IF NOT EXISTS patch_241_detection_drift_monitoring (
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

CREATE INDEX IF NOT EXISTS idx_patch_241_detection_drift_monitoring_tenant_status
  ON patch_241_detection_drift_monitoring(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_241_detection_drift_monitoring_user_created
  ON patch_241_detection_drift_monitoring(user_id, created_at DESC);
