-- Patch 164: Device behavior analytics v2
CREATE TABLE IF NOT EXISTS patch_164_device_behavior_analytics_v2 (
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

CREATE INDEX IF NOT EXISTS idx_patch_164_device_behavior_analytics_v2_tenant_status
  ON patch_164_device_behavior_analytics_v2(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_164_device_behavior_analytics_v2_user_created
  ON patch_164_device_behavior_analytics_v2(user_id, created_at DESC);
