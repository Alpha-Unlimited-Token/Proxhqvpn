-- Patch 179: Bandwidth priority classes
CREATE TABLE IF NOT EXISTS patch_179_bandwidth_priority_classes (
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

CREATE INDEX IF NOT EXISTS idx_patch_179_bandwidth_priority_classes_tenant_status
  ON patch_179_bandwidth_priority_classes(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_179_bandwidth_priority_classes_user_created
  ON patch_179_bandwidth_priority_classes(user_id, created_at DESC);
