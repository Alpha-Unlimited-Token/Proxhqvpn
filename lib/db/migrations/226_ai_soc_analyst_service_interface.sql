-- Patch 226: AI SOC analyst service interface
CREATE TABLE IF NOT EXISTS patch_226_ai_soc_analyst_service_interface (
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

CREATE INDEX IF NOT EXISTS idx_patch_226_ai_soc_analyst_service_interface_tenant_status
  ON patch_226_ai_soc_analyst_service_interface(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_226_ai_soc_analyst_service_interface_user_created
  ON patch_226_ai_soc_analyst_service_interface(user_id, created_at DESC);
