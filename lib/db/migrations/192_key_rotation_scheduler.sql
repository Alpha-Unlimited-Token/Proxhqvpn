-- Patch 192: Key rotation scheduler
CREATE TABLE IF NOT EXISTS patch_192_key_rotation_scheduler (
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

CREATE INDEX IF NOT EXISTS idx_patch_192_key_rotation_scheduler_tenant_status
  ON patch_192_key_rotation_scheduler(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_192_key_rotation_scheduler_user_created
  ON patch_192_key_rotation_scheduler(user_id, created_at DESC);
