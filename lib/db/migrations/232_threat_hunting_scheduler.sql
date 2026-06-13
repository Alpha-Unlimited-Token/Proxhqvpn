-- Patch 232: Threat hunting scheduler
CREATE TABLE IF NOT EXISTS patch_232_threat_hunting_scheduler (
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

CREATE INDEX IF NOT EXISTS idx_patch_232_threat_hunting_scheduler_tenant_status
  ON patch_232_threat_hunting_scheduler(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_232_threat_hunting_scheduler_user_created
  ON patch_232_threat_hunting_scheduler(user_id, created_at DESC);
