-- Patch 209: Alert routing policies
CREATE TABLE IF NOT EXISTS patch_209_alert_routing_policies (
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

CREATE INDEX IF NOT EXISTS idx_patch_209_alert_routing_policies_tenant_status
  ON patch_209_alert_routing_policies(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_209_alert_routing_policies_user_created
  ON patch_209_alert_routing_policies(user_id, created_at DESC);
