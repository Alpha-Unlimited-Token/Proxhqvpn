CREATE TABLE IF NOT EXISTS patch_261_email_report_delivery_adapter (
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

CREATE INDEX IF NOT EXISTS idx_patch_261_email_report_delivery_adapter_tenant_status
  ON patch_261_email_report_delivery_adapter(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_261_email_report_delivery_adapter_user_created
  ON patch_261_email_report_delivery_adapter(user_id, created_at DESC);
