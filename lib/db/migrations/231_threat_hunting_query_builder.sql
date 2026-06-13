-- Patch 231: Threat hunting query builder
CREATE TABLE IF NOT EXISTS patch_231_threat_hunting_query_builder (
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

CREATE INDEX IF NOT EXISTS idx_patch_231_threat_hunting_query_builder_tenant_status
  ON patch_231_threat_hunting_query_builder(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_231_threat_hunting_query_builder_user_created
  ON patch_231_threat_hunting_query_builder(user_id, created_at DESC);
