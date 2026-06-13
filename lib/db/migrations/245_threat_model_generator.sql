CREATE TABLE IF NOT EXISTS patch_245_threat_model_generator (
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

CREATE INDEX IF NOT EXISTS idx_patch_245_threat_model_generator_tenant_status
  ON patch_245_threat_model_generator(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_245_threat_model_generator_user_created
  ON patch_245_threat_model_generator(user_id, created_at DESC);
