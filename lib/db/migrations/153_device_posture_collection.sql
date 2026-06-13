-- Patch 153: Device posture collection
CREATE TABLE IF NOT EXISTS patch_153_device_posture_collection (
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

CREATE INDEX IF NOT EXISTS idx_patch_153_device_posture_collection_tenant_status
  ON patch_153_device_posture_collection(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_153_device_posture_collection_user_created
  ON patch_153_device_posture_collection(user_id, created_at DESC);
