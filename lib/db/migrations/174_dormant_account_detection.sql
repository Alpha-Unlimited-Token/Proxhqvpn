-- Patch 174: Dormant account detection
CREATE TABLE IF NOT EXISTS patch_174_dormant_account_detection (
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

CREATE INDEX IF NOT EXISTS idx_patch_174_dormant_account_detection_tenant_status
  ON patch_174_dormant_account_detection(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_174_dormant_account_detection_user_created
  ON patch_174_dormant_account_detection(user_id, created_at DESC);
