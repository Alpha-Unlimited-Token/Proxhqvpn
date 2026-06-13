CREATE TABLE IF NOT EXISTS patch_253_tenant_admin_console_shell (
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

CREATE INDEX IF NOT EXISTS idx_patch_253_tenant_admin_console_shell_tenant_status
  ON patch_253_tenant_admin_console_shell(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_253_tenant_admin_console_shell_user_created
  ON patch_253_tenant_admin_console_shell(user_id, created_at DESC);
