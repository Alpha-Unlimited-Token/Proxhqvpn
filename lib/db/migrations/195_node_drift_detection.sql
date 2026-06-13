-- Patch 195: Node drift detection
CREATE TABLE IF NOT EXISTS patch_195_node_drift_detection (
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

CREATE INDEX IF NOT EXISTS idx_patch_195_node_drift_detection_tenant_status
  ON patch_195_node_drift_detection(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_195_node_drift_detection_user_created
  ON patch_195_node_drift_detection(user_id, created_at DESC);
