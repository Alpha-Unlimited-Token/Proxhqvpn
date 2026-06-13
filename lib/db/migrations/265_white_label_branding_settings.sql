CREATE TABLE IF NOT EXISTS patch_265_white_label_branding_settings (
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

CREATE INDEX IF NOT EXISTS idx_patch_265_white_label_branding_settings_tenant_status
  ON patch_265_white_label_branding_settings(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_265_white_label_branding_settings_user_created
  ON patch_265_white_label_branding_settings(user_id, created_at DESC);
