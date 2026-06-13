-- Patch 233: Auto-triage rules
CREATE TABLE IF NOT EXISTS patch_233_auto_triage_rules (
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

CREATE INDEX IF NOT EXISTS idx_patch_233_auto_triage_rules_tenant_status
  ON patch_233_auto_triage_rules(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_233_auto_triage_rules_user_created
  ON patch_233_auto_triage_rules(user_id, created_at DESC);
