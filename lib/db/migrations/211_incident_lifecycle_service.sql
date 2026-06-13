-- Patch 211: Incident lifecycle service
CREATE TABLE IF NOT EXISTS patch_211_incident_lifecycle_service (
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

CREATE INDEX IF NOT EXISTS idx_patch_211_incident_lifecycle_service_tenant_status
  ON patch_211_incident_lifecycle_service(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_211_incident_lifecycle_service_user_created
  ON patch_211_incident_lifecycle_service(user_id, created_at DESC);
