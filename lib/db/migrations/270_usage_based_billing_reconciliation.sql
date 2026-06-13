CREATE TABLE IF NOT EXISTS patch_270_usage_based_billing_reconciliation (
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

CREATE INDEX IF NOT EXISTS idx_patch_270_usage_based_billing_reconciliation_tenant_status
  ON patch_270_usage_based_billing_reconciliation(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_270_usage_based_billing_reconciliation_user_created
  ON patch_270_usage_based_billing_reconciliation(user_id, created_at DESC);
