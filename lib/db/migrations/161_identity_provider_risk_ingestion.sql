-- Patch 161: Identity provider risk ingestion
CREATE TABLE IF NOT EXISTS patch_161_identity_provider_risk_ingestion (
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

CREATE INDEX IF NOT EXISTS idx_patch_161_identity_provider_risk_ingestion_tenant_status
  ON patch_161_identity_provider_risk_ingestion(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_161_identity_provider_risk_ingestion_user_created
  ON patch_161_identity_provider_risk_ingestion(user_id, created_at DESC);
