-- Patch 229: Alert clustering
CREATE TABLE IF NOT EXISTS patch_229_alert_clustering (
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

CREATE INDEX IF NOT EXISTS idx_patch_229_alert_clustering_tenant_status
  ON patch_229_alert_clustering(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_229_alert_clustering_user_created
  ON patch_229_alert_clustering(user_id, created_at DESC);
