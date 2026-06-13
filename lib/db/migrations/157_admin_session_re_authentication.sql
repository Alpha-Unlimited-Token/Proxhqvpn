-- Patch 157: Admin session re-authentication
CREATE TABLE IF NOT EXISTS patch_157_admin_session_re_authentication (
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

CREATE INDEX IF NOT EXISTS idx_patch_157_admin_session_re_authentication_tenant_status
  ON patch_157_admin_session_re_authentication(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_157_admin_session_re_authentication_user_created
  ON patch_157_admin_session_re_authentication(user_id, created_at DESC);
