-- Patch 170: Privileged command approval
CREATE TABLE IF NOT EXISTS patch_170_privileged_command_approval (
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

CREATE INDEX IF NOT EXISTS idx_patch_170_privileged_command_approval_tenant_status
  ON patch_170_privileged_command_approval(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_170_privileged_command_approval_user_created
  ON patch_170_privileged_command_approval(user_id, created_at DESC);
