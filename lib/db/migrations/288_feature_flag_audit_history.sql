CREATE TABLE IF NOT EXISTS patch_288_feature_flag_audit_history (
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

CREATE INDEX IF NOT EXISTS idx_patch_288_feature_flag_audit_history_tenant_status
  ON patch_288_feature_flag_audit_history(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_288_feature_flag_audit_history_user_created
  ON patch_288_feature_flag_audit_history(user_id, created_at DESC);
