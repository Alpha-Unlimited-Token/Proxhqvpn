CREATE TABLE IF NOT EXISTS patch_252_enterprise_onboarding_frontend (
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

CREATE INDEX IF NOT EXISTS idx_patch_252_enterprise_onboarding_frontend_tenant_status
  ON patch_252_enterprise_onboarding_frontend(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_252_enterprise_onboarding_frontend_user_created
  ON patch_252_enterprise_onboarding_frontend(user_id, created_at DESC);
