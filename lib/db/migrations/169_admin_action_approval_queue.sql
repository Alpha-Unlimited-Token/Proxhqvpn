-- Patch 169: Admin action approval queue
CREATE TABLE IF NOT EXISTS patch_169_admin_action_approval_queue (
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

CREATE INDEX IF NOT EXISTS idx_patch_169_admin_action_approval_queue_tenant_status
  ON patch_169_admin_action_approval_queue(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_169_admin_action_approval_queue_user_created
  ON patch_169_admin_action_approval_queue(user_id, created_at DESC);
